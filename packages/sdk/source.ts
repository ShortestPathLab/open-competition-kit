/**
 * Getting at what somebody submitted.
 *
 * Every runner needs the same four steps before it can do anything interesting:
 * find the archive, cope with the two ways an integration might have handed it
 * over, unpack it, and keep only the files the submission was allowed to change.
 * Written out per runner, that is sixty lines of boilerplate standing between an
 * organiser and the part they actually care about, and the last step is the one
 * with a security property attached.
 *
 * ## The allowlist is the interesting part
 *
 * The image holds the harness. A submission supplies a handful of files that
 * overlay it, and nothing else in the archive is read. That is what makes an
 * edited `pacman.py`, a rewritten layout or a `sitecustomize.py` that runs before
 * the evaluation into non-issues: none of them is copied anywhere.
 *
 * Written as a filter here rather than left to each runner, because a runner
 * that forgets it does not fail. It scores a submission that rewrote the
 * marking scheme, and reports a number that looks fine.
 */
import { isFile, reference } from "@open-competition-kit/core";
import JSZip from "jszip";
// Straight from `./kit` rather than through the package index, which re-exports
// this module: importing the barrel from inside it would close a cycle, and the
// half that lost the race would see `undefined` where the kit should be.
import { kit } from "./kit";
import { cast, unsafe } from "./result";

/**
 * The archive, however the integration chose to hand it over.
 *
 * Prefers a `FileRef`, which is what an up-to-date integration writes: the bytes
 * live in the large-file backend and stream out of it, so an archive is not
 * capped by what fits in a database row. Falls back to the legacy base64 context
 * value, so jobs created before that migration still run.
 */
export const archive = async (job: string): Promise<Uint8Array | string> => {
  const ref = await cast<unknown>()(
    kit.jobs.context.get({
      owner: job,
      reference: reference.std.submissionSource,
    }),
  );

  if (!ref.error && isFile(ref.value)) {
    const stream = await unsafe(kit.files.read(ref.value));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  const legacy = await cast<string>()(
    kit.jobs.context.get({
      owner: job,
      reference: reference.std.submissionSourceCodeZipB64,
    }),
  );
  if (!legacy.error && typeof legacy.value === "string") return legacy.value;

  throw new Error(
    `No source found for job ${job}. Runners look for a submission under ` +
      `${reference.std.submissionSource}, and fall back to ` +
      `${reference.std.submissionSourceCodeZipB64}. Neither is set, which ` +
      `usually means no integration package claimed this submission.`,
  );
};

/** Whether a pattern names one file or describes a family of them. */
const isGlob = (pattern: string) => pattern.includes("*");

/**
 * A pattern, as a regular expression matched against a path.
 *
 * Anchored at a path boundary rather than at the start of the string, because a
 * GitHub archive wraps everything in a directory named after the repository and
 * the ref. Matching by suffix means a runner never has to guess that name.
 *
 * `*` stops at a separator and `**` crosses them, which is what everybody
 * already expects from a glob and what keeps `problems/*.py` from quietly
 * reaching into `problems/vendor/nested/`.
 */
const toRegExp = (pattern: string) => {
  const source = pattern
    .split(/(\*\*|\*)/)
    .map((part) =>
      part === "**" ? ".*" : part === "*" ? "[^/]*" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("");
  return new RegExp(`(^|/)${source}$`);
};

/**
 * The directory a whole archive sits inside, if it sits inside one.
 *
 * GitHub's zips are wrapped in `repository-ref/`, and a runner asking for
 * `solvers/q1a_solver.py` means the one in there. Stripping the wrapper is what
 * lets the same runner read an archive somebody made with `zip -r` at the top
 * level, without either side knowing which it got.
 *
 * Only stripped when every entry agrees on it. An archive with two top-level
 * directories has no wrapper, it has two directories, and removing one of them
 * would silently merge them.
 */
const wrapper = (paths: readonly string[]) => {
  const segments = new Set(paths.map((path) => path.split("/")[0]));
  if (segments.size !== 1) return "";
  const [only] = [...segments];
  return only && paths.every((path) => path.startsWith(`${only}/`)) ? `${only}/` : "";
};

export type FilesOptions = {
  /**
   * Paths a submission may supply, as literals or globs. Everything else in the
   * archive is ignored.
   *
   * Absent means take the whole archive, which is right for a competition whose
   * submission *is* the data. It is the wrong default for one that overlays a
   * harness, and the difference is worth being deliberate about.
   */
  allow?: readonly string[];
};

/**
 * The permitted files out of an already-open archive, keyed by the path they
 * should land at.
 *
 * Separate from `files` below so the filtering can be exercised against a zip
 * built in a test rather than against a job in a database. That matters more
 * here than in most places: this function is the whole of the rule that stops a
 * submission replacing the harness, and a rule nothing tests is a rule nobody
 * finds out about until it has already let something through.
 *
 * Keys have the wrapper directory removed, so they are the paths the allowlist
 * was written in and can be pasted straight into a machine's `files`.
 *
 * A literal path in `allow` that the archive does not contain is an error naming
 * every one that is missing at once, because a competitor who forgot two files
 * should not have to submit twice to find that out. A glob that matches nothing
 * is not an error: it describes a family, and an empty family is a legitimate
 * submission.
 */
export const select = async (
  zip: JSZip,
  options: FilesOptions = {},
): Promise<Record<string, Uint8Array>> => {
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const patterns = options.allow;

  // With no allowlist there is nothing to match against, so the wrapper has to
  // be guessed. With one, the patterns say where things are and guessing would
  // only get in the way: an archive whose files all sit under `problems/` looks
  // exactly like a wrapped one, and stripping it would leave `problems/*.py`
  // matching nothing.
  const prefix = patterns ? "" : wrapper(entries.map((entry) => entry.name));

  const matchers = patterns?.map(toRegExp);
  const out: Record<string, Uint8Array> = {};

  for (const entry of entries) {
    const path = entry.name.slice(prefix.length);
    if (!path) continue;

    if (!matchers) {
      out[path] = new Uint8Array(await entry.async("arraybuffer"));
      continue;
    }

    // Keyed by where the pattern matched rather than by the whole entry name,
    // which is what removes a GitHub wrapper without anybody having to know its
    // name. `problems/*.py` matching `agent-main/problems/q1a.py` yields
    // `problems/q1a.py`: the path the allowlist was written in.
    const found = matchers.map((matcher) => matcher.exec(path)).find((match) => match !== null);
    if (!found) continue;

    const key = path.slice(found.index + (found[1]?.length ?? 0));
    out[key] = new Uint8Array(await entry.async("arraybuffer"));
  }

  const missing = (patterns ?? [])
    .filter((pattern) => !isGlob(pattern))
    .filter((pattern) => !(pattern in out));

  if (missing.length) {
    throw new Error(`Submission is missing: ${missing.join(", ")}`);
  }

  return out;
};

/**
 * A job's submission, unpacked and filtered, ready to hand to a machine.
 *
 * The one call a runner usually wants. The archive never touches a disk on the
 * way through: it is read into memory, the permitted files are taken out of it,
 * and everything else is dropped.
 */
export const files = async (
  job: string,
  options: FilesOptions = {},
): Promise<Record<string, Uint8Array>> => {
  const source = await archive(job);
  const zip = await JSZip.loadAsync(source, {
    // A string is the legacy base64 payload. Raw bytes come from a FileRef.
    base64: typeof source === "string",
  });
  return select(zip, options);
};
