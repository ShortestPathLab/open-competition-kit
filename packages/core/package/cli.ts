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
 */
import { BunContext } from "@effect/platform-bun";
import { Effect as E, Layer as L } from "effect";
import { OpenCompetitionKitConfig } from "../config";
import { cacheRoot } from "./cache";
import { installAll } from "./install";
import { OpenCompetitionKitPackages } from "./registry";

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
    yield* E.logInfo(`  ${record.uri} -> ${record.version ?? "unversioned"}`);
  }
  yield* E.logInfo(
    records.length > 0
      ? `Fetched ${records.length}. The rest are local and already on disk.`
      : "Nothing to fetch: every package this config names is local.",
  );
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
