/**
 * Filling the package cache, ahead of any service starting.
 *
 * Deliberately not reachable from the boot path. A service that fetches on start
 * is a service that will not start when a registry is having a bad morning, and a
 * competition that is already running should not be able to go down for a reason
 * that has nothing to do with the competition. The runner's `prepare` hook exists
 * for the same argument.
 *
 * Resolution, integrity and transitive dependencies are delegated rather than
 * implemented. Writing a package manager to avoid running one would be a strange
 * trade, and `bun` is already the toolchain every service runs on: it resolves the
 * version, writes its own lockfile inside the cache directory, and installs the
 * dependency tree the package needs before it can be imported. What is recorded
 * here is the mapping from a canonical uri to what bun actually resolved.
 */
import { Command, CommandExecutor, FileSystem, Path } from "@effect/platform";
import { Data, Effect as E } from "effect";
import { cacheDirFor, RECORD_FILE, type InstalledRecord } from "./cache";
import { resolvedFromLock, versionOf } from "./pin";
import { isPackageUriError, parseRef, type PackageRef } from "./uri";

export class InstallError extends Data.TaggedError("InstallError")<{
  uri: string;
  message: string;
}> {}

/** `bun add` understands both of these directly, which is most of why they were chosen. */
const specifierFor = (ref: PackageRef) =>
  ref.scheme === "npm"
    ? ref.version
      ? `${ref.id}@${ref.version}`
      : ref.id
    : ref.version
      ? `github:${ref.id}#${ref.version}`
      : `github:${ref.id}`;

const run = (command: Command.Command, uri: string, what: string) =>
  E.gen(function* () {
    const executor = yield* CommandExecutor.CommandExecutor;
    const exit = yield* executor.exitCode(command);
    if (exit !== 0) {
      return yield* E.fail(new InstallError({ uri, message: `${what} exited with ${exit}.` }));
    }
  });

/**
 * One package into the cache, as an isolated little project of its own.
 *
 * Isolated because two packages may want incompatible versions of the same
 * dependency, and a competition is not the place to discover that they were
 * sharing a `node_modules`.
 */
export const install = (uri: string, root: string, now: string) =>
  E.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const ref = parseRef(uri);
    if (isPackageUriError(ref)) {
      return yield* E.fail(new InstallError({ uri, message: ref.message }));
    }
    if (ref.scheme === "local") {
      // Already on disk, by definition. Nothing to fetch and nothing to record.
      return undefined;
    }

    const dir = cacheDirFor(root, ref);
    yield* fs.makeDirectory(dir, { recursive: true });
    yield* fs.writeFileString(
      path.join(dir, "package.json"),
      `${JSON.stringify({ name: "open-competition-kit-package-cache", private: true }, null, 2)}\n`,
    );

    yield* run(
      Command.make("bun", "add", "--exact", specifierFor(ref)).pipe(Command.workingDirectory(dir)),
      uri,
      `Fetching ${uri}`,
    );

    // Where it landed is bun's answer, not ours: a github package is installed
    // under whatever name its own `package.json` declares, which is not derivable
    // from `org/repo`.
    const modules = path.join(dir, "node_modules");
    const installed = yield* resolveInstalledDir(modules, ref);

    const manifest = yield* fs.readFileString(path.join(installed, "package.json")).pipe(
      E.map((text) => JSON.parse(text) as { name?: string; version?: string }),
      E.orElseSucceed(() => ({}) as { name?: string; version?: string }),
    );

    // What bun settled on, which for a git package is a commit and is the only
    // thing that can be written back into `with:` and still mean this. Read from
    // the lockfile because the installed manifest does not carry it: a github
    // package's `version` field is whatever its author last wrote there, and is
    // the same string for every commit since.
    const name = manifest.name ?? (ref.scheme === "npm" ? ref.id : undefined);
    const resolved = name
      ? yield* fs.readFileString(path.join(dir, "bun.lock")).pipe(
          E.map((lock) => resolvedFromLock(lock, name)),
          E.orElseSucceed(() => undefined),
        )
      : undefined;

    const record: InstalledRecord = {
      uri,
      version: manifest.version,
      dir: installed,
      installedAt: now,
      resolved: resolved && name ? versionOf(resolved, name) : undefined,
    };
    yield* fs.writeFileString(path.join(dir, RECORD_FILE), `${JSON.stringify(record, null, 2)}\n`);
    return record;
  });

/**
 * The directory holding the package, inside the cache project's `node_modules`.
 *
 * An npm ref names it. A github ref does not, so the single installed entry is
 * taken, which is correct because each cache directory holds exactly one added
 * package and everything else beside it is that package's own dependencies.
 */
const resolveInstalledDir = (modules: string, ref: PackageRef) =>
  E.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    if (ref.scheme === "npm") return path.join(modules, ref.id);

    const entries = yield* fs.readDirectory(modules).pipe(E.orElseSucceed(() => [] as string[]));
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      if (entry.startsWith("@")) {
        const scoped = yield* fs
          .readDirectory(path.join(modules, entry))
          .pipe(E.orElseSucceed(() => [] as string[]));
        const [first] = scoped;
        if (first) return path.join(modules, entry, first);
        continue;
      }
      return path.join(modules, entry);
    }
    return yield* E.fail(
      new InstallError({ uri: ref.uri, message: `Nothing was installed into ${modules}.` }),
    );
  });

/** Every uri a config names, fetched, reporting all the failures rather than the first. */
export const installAll = (uris: readonly string[], root: string, now: string) =>
  E.gen(function* () {
    const failures: string[] = [];
    const records: InstalledRecord[] = [];
    for (const uri of uris) {
      const record = yield* install(uri, root, now).pipe(
        E.catchAll((error) =>
          E.sync(() => {
            failures.push(`  ${uri}: ${error.message}`);
            return undefined;
          }),
        ),
      );
      if (record) records.push(record);
    }
    if (failures.length > 0) {
      return yield* E.fail(
        new InstallError({
          uri: uris.join(", "),
          message: `${failures.length} package(s) could not be installed:\n${failures.join("\n")}`,
        }),
      );
    }
    return records;
  });
