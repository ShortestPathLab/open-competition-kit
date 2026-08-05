/**
 * What a `with:` entry names, and the one spelling of it everything else uses.
 *
 * An entry may be written fully qualified, as `scheme:rest`, or bare and left to
 * be recognised by its shape. Either way it becomes a `PackageRef`, and the `uri`
 * on that ref is the only form anything downstream should hold: it is the memo
 * key, the lockfile key, the text an error names, and the `source` a config editor
 * attributes a field to.
 *
 * Canonicalising matters more than it looks. `withAt` deduplicates `with:` lists
 * with `uniq` over raw strings, so `./x` at the root and `local:./x` on a track
 * survive as two entries, and a memo keyed on the resolved form afterwards cannot
 * undo that: the package is already in the chain twice and has contributed its
 * config fields twice. The list has to be normalised before anything reads it.
 */
import { Data } from "effect";

export type Scheme = "local" | "npm" | "github";

export type PackageRef = {
  scheme: Scheme;
  /** Scheme-specific and normalised: an absolute path, a package name, `org/repo`. */
  id: string;
  /** Version, tag or commit. Absent means unpinned. */
  version?: string;
  /** The canonical spelling of the whole thing. */
  uri: string;
};

export class PackageUriError extends Data.TaggedError("PackageUriError")<{
  specifier: string;
  message: string;
}> {}

/** `scheme:rest`, where a scheme is a word and not the start of a Windows path. */
const QUALIFIED = /^([a-z][a-z0-9+.-]*):(.*)$/;

/**
 * A version suffix, split on the last `@` rather than the first.
 *
 * `@open-competition-kit/standard` is a name and not a versioned `open-competition-kit/standard`,
 * so an `@` at position zero is part of the scope. Getting this wrong is invisible
 * until somebody writes a scoped name, which is every name this kit publishes.
 */
const splitVersion = (spec: string): { id: string; version?: string } => {
  const hash = spec.indexOf("#");
  if (hash > 0) {
    return { id: spec.slice(0, hash), version: spec.slice(hash + 1) };
  }
  const at = spec.lastIndexOf("@");
  if (at <= 0) return { id: spec };
  return { id: spec.slice(0, at), version: spec.slice(at + 1) };
};

const uriOf = (scheme: Scheme, id: string, version?: string) =>
  version ? `${scheme}:${id}@${version}` : `${scheme}:${id}`;

/**
 * Whether a bare specifier is this scheme's.
 *
 * The predicates below are disjoint, which is deliberate: an ordered list of
 * overlapping claimers looks like it has handled ambiguity when it has only
 * hidden it. `parseRef` collects every match and refuses on more than one rather
 * than taking the first, so the day a fourth scheme overlaps with one of these,
 * it says so instead of quietly picking a winner.
 *
 * Worth knowing that it caught one already. An earlier `github` pattern of
 * `[^@/][^/]*\/[^/]+` matched `../elsewhere`, reading the owner as `..`.
 */
type Claimer = {
  scheme: Scheme;
  /** Recognises a bare specifier by its shape. */
  claims: (specifier: string) => boolean;
  /** Splits the part after `scheme:`, or the whole bare specifier. */
  parse: (rest: string) => { id: string; version?: string };
};

const CLAIMERS: readonly Claimer[] = [
  {
    scheme: "local",
    // A path is the one thing that cannot be confused with a package name.
    claims: (s) => s.startsWith("./") || s.startsWith("../") || s.startsWith("/"),
    // A local path carries no version. `@` is legal in a directory name, and a
    // path is already an exact reference to whatever is at the end of it.
    parse: (rest) => ({ id: rest }),
  },
  {
    scheme: "npm",
    // `@scope/name` belongs to npm, and a bare word does too, but a bare word is
    // also how a built-in would be spelled, so that case is settled before the
    // sweep runs rather than here.
    claims: (s) => /^@[^/]+\/[^/]+$/.test(splitVersion(s).id),
    parse: splitVersion,
  },
  {
    scheme: "github",
    // `org/repo`. npm has no unscoped name containing a slash, so the slash is the
    // discriminator, and the leading character has to be alphanumeric or `../x`
    // reads as an owner called `..`. A GitHub owner starts alphanumeric anyway.
    claims: (s) => /^[a-zA-Z0-9][\w.-]*\/[\w.-]+$/.test(splitVersion(s).id),
    parse: splitVersion,
  },
];

const bySchemeName = new Map(CLAIMERS.map((c) => [c.scheme as string, c]));

/**
 * The ref a specifier names, with local paths still as written.
 *
 * Pure, so it can be tested without a filesystem. `canonicalise` is what turns a
 * local id into the absolute path that makes two spellings of one package the
 * same package.
 */
export const parseRef = (specifier: string): PackageRef | PackageUriError => {
  const trimmed = specifier.trim();
  if (!trimmed) {
    return new PackageUriError({ specifier, message: "It is empty." });
  }

  const qualified = QUALIFIED.exec(trimmed);
  if (qualified) {
    const [, scheme = "", rest = ""] = qualified;
    const claimer = bySchemeName.get(scheme);
    if (!claimer) {
      return new PackageUriError({
        specifier,
        message:
          `\`${scheme}:\` is not a scheme this kit knows. ` +
          `Use ${CLAIMERS.map((c) => `\`${c.scheme}:\``).join(", ")}, ` +
          `or leave the scheme off and let the name decide.`,
      });
    }
    if (!rest) {
      return new PackageUriError({
        specifier,
        message: `\`${scheme}:\` names nothing.`,
      });
    }
    const { id, version } = claimer.parse(rest);
    return { scheme: claimer.scheme, id, version, uri: uriOf(claimer.scheme, id, version) };
  }

  const claimed = CLAIMERS.filter((c) => c.claims(trimmed));
  const [only] = claimed;
  if (!only) {
    return new PackageUriError({
      specifier,
      message:
        "It does not look like a path, a scoped npm name, or `org/repo`. " +
        "Write the scheme, as in `npm:my-package`.",
    });
  }
  if (claimed.length > 1) {
    return new PackageUriError({
      specifier,
      message:
        `It could be ${claimed.map((c) => `\`${c.scheme}:\``).join(" or ")}. ` +
        "Write the scheme so there is nothing to guess.",
    });
  }
  const { id, version } = only.parse(trimmed);
  return { scheme: only.scheme, id, version, uri: uriOf(only.scheme, id, version) };
};

/**
 * The ref, with a local path made absolute against wherever the config was found.
 *
 * `resolveLocal` is passed in rather than reached for, so this stays free of a
 * filesystem and of any particular path implementation, and so a test can hand it
 * a function instead of a directory.
 */
export const canonicalise = (
  specifier: string,
  resolveLocal: (path: string) => string,
): PackageRef | PackageUriError => {
  const ref = parseRef(specifier);
  if (ref instanceof PackageUriError || ref.scheme !== "local") return ref;
  const id = resolveLocal(ref.id);
  return { ...ref, id, uri: uriOf("local", id) };
};

export const isPackageUriError = (value: PackageRef | PackageUriError): value is PackageUriError =>
  value instanceof PackageUriError;
