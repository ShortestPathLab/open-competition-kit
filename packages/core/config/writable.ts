/**
 * Whether the config file can be saved to, asked the way a save asks it.
 *
 * A settings page has to know before it offers the button, because the two
 * deployments that cannot save look identical from the browser: a file bind
 * mounted read only, and a file owned by somebody the service is not. Both are
 * ordinary. What is not ordinary is finding out by pressing Save.
 *
 * The probe is a moment in time and the write is the truth. Nothing here is
 * relied on for correctness: the writer reports its own failure whatever this
 * said a second earlier. This exists so the UI can say something honest first.
 */
import { FileSystem, Path } from "@effect/platform";
import { Effect as E, Either } from "effect";

export type ConfigWritabilityReason =
  | "ok"
  /** The file, or the filesystem under it, is mounted read only. */
  | "readOnly"
  /** The file is writable by somebody, and not by whoever this service runs as. */
  | "notPermitted"
  /** Nothing is there. */
  | "missing"
  /** Something else refused, and `detail` carries what the system said. */
  | "unknown";

/**
 * How a save replaces the file.
 *
 * `rename` writes a temporary file beside it and renames over the top, so a
 * reader either gets the old file or the new one and never a half written one.
 * That needs a writable directory, and it needs the file not to be its own mount
 * point: `docker run -v ./competition.config.yaml:/config.yaml` produces exactly
 * that, and renaming onto it fails with `EBUSY`. `inPlace` truncates and rewrites
 * instead, which keeps the mount and gives up the atomicity.
 */
export type ConfigWriteStrategy = "rename" | "inPlace";

export type ConfigWritability = {
  writable: boolean;
  /** The file the config was read from, resolved. */
  path: string;
  reason: ConfigWritabilityReason;
  /** A sentence for whoever is looking at the settings page. */
  detail: string;
  strategy: ConfigWriteStrategy;
};

/**
 * The errno behind a platform error, when there is one.
 *
 * `SystemError.reason` is a short list that does not have a word for a read only
 * filesystem, so `EROFS` arrives as `Unknown` with the original error kept as the
 * cause. That is the one case worth telling apart from a permissions problem:
 * they are fixed in completely different places.
 */
export const errnoOf = (error: unknown): string | undefined => {
  const cause = (error as { cause?: unknown })?.cause;
  const code = (cause as { code?: unknown })?.code;
  return typeof code === "string" ? code : undefined;
};

const describeError = (path: string, error: unknown): Omit<ConfigWritability, "strategy"> => {
  const base = { writable: false, path } as const;

  switch (errnoOf(error)) {
    case "ENOENT":
      return {
        ...base,
        reason: "missing",
        detail: `${path} is not there. It was read at startup, so something has moved or unmounted it since.`,
      };
    case "EROFS":
      return {
        ...base,
        reason: "readOnly",
        detail: `${path} is on a read only filesystem. Mount it writable to save changes from here.`,
      };
    case "EACCES":
    case "EPERM":
      return {
        ...base,
        reason: "notPermitted",
        detail: `${path} is not writable by the user this service runs as. Change the file's owner or mode to save changes from here.`,
      };
    default:
      return {
        ...base,
        reason: "unknown",
        detail: `${path} could not be opened for writing. ${String(error)}`,
      };
  }
};

/**
 * Whether a file and its directory are on the same filesystem.
 *
 * A file that sits on a different device from its own directory is its own mount
 * point, and renaming onto a mount point fails however writable the directory is.
 */
const onSameDevice = (fs: FileSystem.FileSystem, path: string, directory: string) =>
  E.gen(function* () {
    const file = yield* E.either(fs.stat(path));
    const parent = yield* E.either(fs.stat(directory));
    if (Either.isLeft(file) || Either.isLeft(parent)) return false;
    return file.right.dev === parent.right.dev;
  });

/**
 * Can this file be saved to, and how.
 *
 * Opened `r+` and closed without writing a byte, because that is the permission a
 * save actually needs and `access(W_OK)` is not: it answers about the file while
 * the safe write replaces it, which is a question about the directory. Both are
 * asked, and the answers pick the strategy rather than the verdict.
 */
export const probeWritable = (
  path: string,
): E.Effect<ConfigWritability, never, FileSystem.FileSystem | Path.Path> =>
  E.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    const opened = yield* E.either(E.scoped(fs.open(path, { flag: "r+" })));

    if (Either.isLeft(opened)) {
      return { ...describeError(path, opened.left), strategy: "inPlace" as const };
    }

    const directory = pathService.dirname(path);

    const canReplace = yield* E.either(fs.access(directory, { writable: true }));
    const sameDevice = yield* onSameDevice(fs, path, directory);

    return {
      writable: true,
      path,
      reason: "ok" as const,
      detail: `Changes are saved to ${path}.`,
      strategy: Either.isRight(canReplace) && sameDevice ? "rename" : "inPlace",
    };
  });

/** Where the previous contents go before they are replaced. */
export const backupOf = (path: string) => `${path}.bak`;

/**
 * The config file, replaced.
 *
 * The previous contents are kept twice over. Once beside the file as `.bak`, for
 * an organiser who wants their old wording back, and once in memory, so a write
 * that fails halfway leaves the file as it was rather than truncated. A config
 * file cut in half does not boot, and the service that would have told somebody
 * about it is the one that will not start.
 *
 * The backup is best effort. It is a convenience, not the safety net: what makes
 * this safe is that the caller has already loaded the new text and confirmed it
 * boots.
 */
export const writeConfigFile = ({
  path,
  previous,
  next,
  strategy,
}: {
  path: string;
  previous: string;
  next: string;
  strategy: ConfigWriteStrategy;
}) =>
  E.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const backup = yield* E.either(fs.writeFileString(backupOf(path), previous));
    if (Either.isLeft(backup)) {
      yield* E.logWarning(`Could not write ${backupOf(path)}: ${String(backup.left)}`);
    }

    if (strategy === "inPlace") {
      const written = yield* E.either(fs.writeFileString(path, next));
      if (Either.isLeft(written)) {
        // Put back what was there. If this fails too there is nothing further to
        // try, and the `.bak` beside it is the way back.
        yield* E.ignore(fs.writeFileString(path, previous));
        return yield* E.fail(written.left);
      }
      return;
    }

    const temporary = `${path}.ock-tmp`;

    const replaced = yield* E.either(
      E.gen(function* () {
        yield* fs.writeFileString(temporary, next);
        // A fresh file is created with default permissions, and this one takes
        // the place of a file that may deliberately have had tighter ones: a
        // config holds secrets, and a `chmod 600` on it should survive a save.
        const { mode } = yield* fs.stat(path);
        yield* fs.chmod(temporary, mode & 0o7777);
        yield* fs.rename(temporary, path);
      }),
    );

    if (Either.isLeft(replaced)) {
      yield* E.ignore(fs.remove(temporary));
      return yield* E.fail(replaced.left);
    }
  });
