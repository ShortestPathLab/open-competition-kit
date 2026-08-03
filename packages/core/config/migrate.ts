/**
 * Config an organiser wrote before we changed our minds.
 *
 * Runs on the parsed YAML, before core's schema sees it, so everything
 * downstream only ever meets the current spelling. Strict validation makes a
 * stale key fatal rather than ignored, which is the right way round for a typo
 * and the wrong way round for a rename we chose ourselves.
 *
 * Deliberately a list of two-word entries and not a migration framework. Each
 * one is meant to be deleted a release or two after it lands, once the warning
 * has had time to be seen.
 */
import { Effect as E } from "effect";

/**
 * Old name, current name.
 *
 * `largeFiles` became `files` because that is the hook namespace it configures,
 * the way `db:` configures `db` and `sandbox:` configures `sandbox`. The "large"
 * described what the package was built for rather than what it does: the backend
 * behind it stores every file, whatever its size.
 */
const RENAMED = [["largeFiles", "files"]] as const;

/**
 * Which warnings have already been said.
 *
 * The config is read more than once per process, once to validate and once to
 * describe, and a startup warning printed twice reads as two different problems.
 */
const said = new Set<string>();

const warnOnce = (key: string, message: string) =>
  E.gen(function* () {
    if (said.has(key)) return;
    said.add(key);
    yield* E.logWarning(message);
  });

export const migrate = (loaded: unknown) =>
  E.gen(function* () {
    if (!loaded || typeof loaded !== "object" || Array.isArray(loaded)) {
      return loaded;
    }

    const config = loaded as Record<string, unknown>;

    for (const [from, to] of RENAMED) {
      if (!(from in config)) continue;

      // Both present means the file is mid-edit. Take the current name and say
      // which one is being dropped, rather than silently picking a winner.
      if (to in config) {
        yield* warnOnce(
          `${from}:both`,
          `Config has both \`${from}:\` and \`${to}:\`. \`${from}\` was renamed to \`${to}\`, so the old block is being ignored. Delete it.`,
        );
        delete config[from];
        continue;
      }

      yield* warnOnce(
        `${from}:renamed`,
        `\`${from}:\` has been renamed to \`${to}:\`. The old name still works for now and will stop working in a future release.`,
      );
      config[to] = config[from];
      delete config[from];
    }

    return config;
  });
