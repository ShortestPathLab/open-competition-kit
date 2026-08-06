/**
 * Where a fetched package is kept, and what is recorded about it.
 *
 * Its own module because both halves need it and they must not need each other:
 * the registry reads the cache at boot and never writes, and the install step
 * writes it and is never reachable from a boot path.
 *
 * Keyed on the canonical uri and the version, so two competitions on one host
 * share a package and a version bump does not evict the copy something is
 * currently running against. That is name addressing rather than content
 * addressing, which is why the record carries what was actually resolved: the
 * name says which package, and the record says which one you got.
 */
import { Config as C } from "effect";
import type { PackageRef } from "./uri";

/**
 * Shared per host rather than per competition, so the same package is not fetched
 * once per config, and outside any checkout so that deleting one does not quietly
 * discard a pinned artifact.
 */
export const cacheRoot = C.string("OCK_PACKAGE_CACHE").pipe(
  C.orElse(() =>
    C.string("XDG_CACHE_HOME").pipe(C.map((base) => `${base}/open-competition-kit/packages`)),
  ),
  C.orElse(() =>
    C.string("HOME").pipe(C.map((home) => `${home}/.cache/open-competition-kit/packages`)),
  ),
  C.withDefault("/tmp/open-competition-kit/packages"),
);

/** One directory per uri, named after it so the cache can be read by a person. */
export const cacheDirFor = (root: string, ref: PackageRef) =>
  `${root}/${ref.uri.replace(/[^a-zA-Z0-9._@-]/g, "_")}`;

/** What was fetched, so a later boot can tell what it actually has. */
export type InstalledRecord = {
  uri: string;
  /** What the range resolved to. The thing a lockfile has to pin. */
  version?: string;
  /** Where the package itself ended up, which is not the cache directory. */
  dir: string;
  installedAt: string;
  /**
   * The exact artifact, as the package manager named it: `1.2.3` for a registry
   * package, a commit for a git one.
   *
   * Distinct from `version`, which is whatever the package's own `package.json`
   * claims. Those agree for npm and do not for github, where the manifest says
   * something like `7.0.0` for every commit on the branch. This is the one that
   * can be written back into `with:` and mean the same thing tomorrow.
   */
  resolved?: string;
};

export const RECORD_FILE = "open-competition-kit.installed.json";
