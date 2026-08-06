/**
 * Whether a `with:` entry names one exact artifact, and what to write if it does
 * not.
 *
 * The reproducibility problem is small and specific: `npm:@open-competition-kit/standard`
 * is a different package on Tuesday than it was on Monday, so two hosts given the
 * same config can run different code, and a competition cannot say afterwards
 * what produced its results.
 *
 * The fix is the specifier itself rather than a file beside it. A lockfile is a
 * second source of truth that has to be kept, shipped and reconciled with the
 * config, and it answers a question the config is already shaped to answer: a
 * `with:` entry is a name, and a name can carry a version. `npm:x@1.2.3` and
 * `github:org/repo#<sha>` each name exactly one artifact, forever, with nothing
 * else to carry alongside them.
 *
 * What counts as exact differs by scheme, which is the whole content of this
 * module.
 */
import type { PackageRef } from "./uri";

/** An npm version with no room to move: `1.2.3`, or `1.2.3-rc.1`, and nothing else. */
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/;

/** A commit, short or full. Bun writes the short form, and resolves either. */
const COMMIT = /^[0-9a-f]{7,40}$/;

/**
 * Whether this entry will still mean the same thing next month.
 *
 * A local path is pinned by definition: it names a directory on this host, and
 * whatever is in it is what runs. There is no resolution step to be
 * non-deterministic about, so there is nothing to warn an organiser working on a
 * checkout about.
 *
 * A tag is deliberately not enough for `github:`. Tags move, and a competition
 * that pinned `#v2` and was quietly moved onto a rewritten `v2` has no way to
 * find out. Bun resolves a tag to a commit at install time, so the pinned
 * spelling is always available; it just has to be written down.
 */
export const isPinned = (ref: PackageRef): boolean => {
  if (ref.scheme === "local") return true;
  if (!ref.version) return false;
  return ref.scheme === "npm" ? EXACT_VERSION.test(ref.version) : COMMIT.test(ref.version);
};

/**
 * The version part of what a package manager actually resolved.
 *
 * Bun records `name@1.2.3` for a registry package and
 * `name@github:org/repo#98e8ff1` for a git one, so the useful part is whatever
 * follows the name, and for git it is whatever follows the `#`.
 */
export const versionOf = (resolved: string, name: string): string | undefined => {
  const rest = resolved.startsWith(`${name}@`) ? resolved.slice(name.length + 1) : resolved;
  if (!rest) return undefined;
  const hash = rest.lastIndexOf("#");
  return hash >= 0 ? rest.slice(hash + 1) : rest;
};

/**
 * How to write this entry so it stays put, given what it resolved to today.
 *
 * `undefined` when there is nothing to say: the entry is already pinned, or
 * nothing was recorded about what it resolved to, and inventing a pin from a
 * guess is worse than leaving it unpinned and saying so.
 */
export const pinnedUri = (ref: PackageRef, version: string | undefined): string | undefined => {
  if (isPinned(ref) || !version) return undefined;
  return ref.scheme === "npm" ? `npm:${ref.id}@${version}` : `github:${ref.id}#${version}`;
};

/**
 * Pull one package's resolved specifier out of a bun lockfile.
 *
 * Read with a pattern rather than parsed, because the file is JSONC: it carries
 * trailing commas that `JSON.parse` refuses, and taking on a JSONC parser to read
 * one string out of a file bun wrote is not a trade worth making. The shape being
 * matched is stable and narrow, and a miss returns `undefined`, which the caller
 * already has to handle for the case where there is no lockfile at all.
 */
export const resolvedFromLock = (lock: string, name: string): string | undefined => {
  const escaped = name.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const entry = new RegExp(String.raw`"${escaped}"\s*:\s*\[\s*"([^"]+)"`).exec(lock);
  return entry?.[1];
};
