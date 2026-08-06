/**
 * The install step, as something to run.
 *
 *     CONFIG=./competition.config.yaml bun packages/core/package/cli.ts
 *
 * Reads the config the services would read, collects every package any node
 * installs, and fetches the ones that are not already on disk. Nothing here runs
 * at boot, which is the point: a service that fetches when it starts is a service
 * that will not start when a registry is unreachable, and a competition that is
 * already running should not be able to go down for that.
 *
 * It also reports which entries are not pinned to one exact artifact, and prints
 * the spelling that would pin each one. Set `OCK_REQUIRE_PINNED=1` to make that a
 * failure instead, which is what a deployment that has to reproduce its results
 * wants.
 */
import { BunContext } from "@effect/platform-bun";
import { Effect as E, Layer as L } from "effect";
import { OpenCompetitionKitConfig } from "../config";
import { cacheRoot, type InstalledRecord } from "./cache";
import { installAll, InstallError } from "./install";
import { isPinned, pinnedUri } from "./pin";
import { OpenCompetitionKitPackages } from "./registry";
import { isPackageUriError, parseRef } from "./uri";

const isNode = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Every `with:` in the tree. A track may install something the root does not. */
const collect = (node: unknown, found: Set<string> = new Set()): Set<string> => {
  if (Array.isArray(node)) {
    node.forEach((child) => collect(child, found));
    return found;
  }
  if (!isNode(node)) return found;
  if (Array.isArray(node.with)) {
    for (const entry of node.with) if (typeof entry === "string") found.add(entry);
  }
  for (const value of Object.values(node)) collect(value, found);
  return found;
};

const program = E.gen(function* () {
  const config = yield* OpenCompetitionKitConfig;
  // `raw` rather than `config`, which runs the preflight this command exists to
  // satisfy and would refuse before anything could be fetched.
  const tree = yield* config.raw;
  const uris = [...collect(tree)];
  const root = yield* cacheRoot;

  yield* E.logInfo(`${uris.length} package(s) named, cache at ${root}`);
  const records = yield* installAll(uris, root, new Date().toISOString());

  for (const record of records) {
    yield* E.logInfo(`  ${record.uri} -> ${record.resolved ?? record.version ?? "unversioned"}`);
  }
  yield* E.logInfo(
    records.length > 0
      ? `Fetched ${records.length}. The rest are local and already on disk.`
      : "Nothing to fetch: every package this config names is local.",
  );

  yield* reportPins(uris, records);
});

/**
 * What this config would resolve differently on another host, and how to stop it.
 *
 * Advice by default and an error on request, because the two audiences want
 * opposite things. Somebody trying the kit for an afternoon writing
 * `npm:@open-competition-kit/standard` should not be stopped and told to go and
 * find a version number; somebody deploying a competition that has to be able to
 * explain its results later should not be able to do it by accident. So the
 * default prints the exact lines to paste, and `OCK_REQUIRE_PINNED=1` in a
 * deployment turns the same finding into a failed install.
 */
const reportPins = (uris: readonly string[], records: readonly InstalledRecord[]) =>
  E.gen(function* () {
    const resolvedBy = new Map(records.map((record) => [record.uri, record.resolved]));
    const loose: { uri: string; pinned: string | undefined }[] = [];

    for (const uri of uris) {
      const ref = parseRef(uri);
      if (isPackageUriError(ref) || isPinned(ref)) continue;
      loose.push({ uri, pinned: pinnedUri(ref, resolvedBy.get(uri)) });
    }

    if (loose.length === 0) {
      yield* E.logInfo("Every package is pinned. This config resolves the same way anywhere.");
      return;
    }

    const lines = loose.map(({ uri, pinned }) =>
      pinned ? `  ${uri}  ->  ${pinned}` : `  ${uri}  ->  (nothing recorded what this resolved to)`,
    );
    const message =
      `${loose.length} package(s) are not pinned, so this config can resolve to different ` +
      `code on another host or on another day. Write them in \`with:\` as:\n${lines.join("\n")}`;

    if (process.env.OCK_REQUIRE_PINNED) {
      return yield* E.fail(new InstallError({ uri: loose.map((l) => l.uri).join(", "), message }));
    }
    yield* E.logWarning(message);
  });

const Packages = OpenCompetitionKitPackages.Default;

await E.runPromise(
  program.pipe(
    E.provide(L.provide(OpenCompetitionKitConfig.Default, Packages)),
    E.provide(Packages),
    E.provide(BunContext.layer),
    E.tapErrorCause((cause) => E.logError(cause)),
  ),
).catch(() => process.exit(1));
