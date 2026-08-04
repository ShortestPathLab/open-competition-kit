/**
 * Making an evaluation image exist.
 *
 * Kept apart from the code that runs containers because the two have opposite
 * postures. A run confines a stranger's code as tightly as it can; a build
 * executes the organiser's own recipe, with a network, because that is what
 * `apt-get` and `git clone` need. Mixing them in one file would invite somebody
 * to reach for the confinement flags here and wonder why nothing installs.
 *
 * ## Why the tag is a hash
 *
 * A fixed tag like `ock-pacman:dev` cannot say whether the image on the host is
 * the one the current Dockerfile describes. An organiser edits the recipe, the
 * tag stays put, and every submission is scored against yesterday's harness with
 * nothing anywhere reporting a problem. Naming the image after its inputs makes
 * that unrepresentable: a changed recipe is a different tag, a different tag is
 * a cache miss, and a cache miss builds.
 *
 * The old tag is left on the host rather than removed. Reclaiming it would break
 * a job that is mid-run against it, and `docker image prune` is a decision for
 * whoever owns the disk.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type BuildRequest = {
  dockerfile: string;
  context?: string;
  args?: Readonly<Record<string, string>>;
  tag?: string;
};

export type BuildResult = { image: string; built: boolean; log: string };

/** Runs `docker`. Injected so the tag logic can be tested without a daemon. */
export type Docker = (
  args: string[],
) => Promise<{ stdout: string; stderr: string; code: number }>;

/**
 * A name for exactly these inputs.
 *
 * Every input goes in, the build arguments included: `PACMAN_REF=fit5047a1` and
 * `PACMAN_REF=master` are two different harnesses out of one recipe, and a hash
 * that ignored them would serve the first to a competition that asked for the
 * second. Keys are sorted so that writing the same arguments in a different
 * order is the same image rather than a rebuild.
 *
 * `context` contributes its path and not its contents. Hashing a directory that
 * may hold a dataset is not worth the read on every startup, and the path is
 * enough to tell two competitions apart. A recipe whose context changes underneath
 * a fixed path rebuilds only when something else does, which is the one case
 * where `force` is the answer.
 */
export const tagFor = async (request: BuildRequest): Promise<string> => {
  const material = JSON.stringify([
    request.dockerfile,
    request.context ?? "",
    Object.entries(request.args ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)),
  ]);
  const digest = new Bun.CryptoHasher("sha256").update(material).digest("hex");

  // The prefix is the organiser's, so an image is recognisable in `docker
  // images` rather than being one of several anonymous hashes. Sanitised
  // because a tag is not a free-form string: Docker takes lowercase
  // alphanumerics and a few separators, and a competition id like `FIT5047`
  // would be refused with a message about the tag rather than about the id.
  const prefix = (request.tag ?? "ock-build")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 64);

  return `${prefix || "ock-build"}:${digest.slice(0, 16)}`;
};

/**
 * Builds in flight, keyed by tag.
 *
 * The runner service processes every pending job in one `Promise.all`, so the
 * first poll after a restart can ask for the same image several times at once.
 * Without this they would each miss the cache and each run `apt-get`, which is
 * slow rather than wrong, but slow measured in minutes.
 *
 * Only in-process. Two runner containers sharing a daemon can still build the
 * same tag twice, and that is fine: the builds are identical and the loser's
 * layers are already in the daemon's cache.
 */
const inFlight = new Map<string, Promise<BuildResult>>();

/** Whether the daemon already has this exact image. */
const present = async (docker: Docker, image: string) =>
  (await docker(["image", "inspect", image])).code === 0;

const build = async (
  docker: Docker,
  request: BuildRequest,
  image: string,
): Promise<BuildResult> => {
  if (await present(docker, image)) {
    return { image, built: false, log: "" };
  }

  // The recipe arrives as text, and `docker build` wants a path, so it lands in
  // a scratch directory either way. That directory doubles as the build context
  // when the caller named none, which is the case worth getting right: `docker
  // build .` from the runner's working directory would stream the whole kit to
  // the daemon before failing to copy any of it.
  const scratch = await mkdtemp(join(tmpdir(), "ock-build-"));
  const context = request.context ?? scratch;

  try {
    const dockerfile = join(scratch, "Dockerfile");
    await writeFile(dockerfile, request.dockerfile);

    const result = await docker([
      "build",
      "-f",
      dockerfile,
      "-t",
      image,
      ...Object.entries(request.args ?? {}).flatMap(([k, v]) => [
        "--build-arg",
        `${k}=${v}`,
      ]),
      context,
    ]);

    // Docker writes progress to stderr and only the final image id to stdout, so
    // a log that read stdout alone would be empty for every interesting failure.
    const log = [result.stdout, result.stderr].filter(Boolean).join("\n");

    if (result.code !== 0) {
      throw new Error(
        `Could not build the evaluation image "${image}". Docker said:\n${log.trim()}`,
      );
    }

    return { image, built: true, log };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
};

/**
 * The image for this recipe, building it if the host does not have it.
 *
 * Returns the tag to run, which is the derived one and not whatever `tag` asked
 * for: the caller wants an image that matches the recipe it just handed over,
 * and the only name that can promise that is the one derived from it.
 */
export const ensure = async (
  docker: Docker,
  request: BuildRequest,
): Promise<BuildResult> => {
  const image = await tagFor(request);

  const existing = inFlight.get(image);
  if (existing) return existing;

  const started = build(docker, request, image).finally(() => {
    inFlight.delete(image);
  });
  inFlight.set(image, started);
  return started;
};
