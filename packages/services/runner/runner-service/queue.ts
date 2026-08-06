/**
 * How many evaluations may be in flight at once.
 *
 * An environment variable rather than a config field, because it describes the
 * host and not the competition. `standard-package-split.md` makes the argument:
 * config vocabulary cannot be un-declared, so a field is a promise that every
 * deployment has to live with. Two runners on different machines will want
 * different numbers here, and neither number belongs in a file both of them read.
 *
 * The default is small on purpose. Every slot is a container with a memory and
 * CPU ceiling of its own, so the ceiling that matters is the product, and a
 * classroom hitting a deadline together is the normal case rather than the
 * unusual one.
 */
const DEFAULT_CONCURRENCY = 4;

export const concurrencyFrom = (raw: string | undefined): number => {
  if (raw === undefined || raw.trim() === "") return DEFAULT_CONCURRENCY;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    console.warn(
      `[runner-service] OCK_RUNNER_CONCURRENCY is "${raw}", which is not a whole number ` +
        `of at least 1. Using ${DEFAULT_CONCURRENCY}.`,
    );
    return DEFAULT_CONCURRENCY;
  }
  return parsed;
};

/**
 * What to leave a job as, once the chain has had its turn.
 *
 * `undefined` means leave it alone: a runner already wrote a terminal status and
 * cleared its own claim, which is the ordinary path and the one that must not be
 * overwritten.
 *
 * Anything else is a job still sitting at `running` after every runner has been
 * asked, so the claim this service took is the only thing holding it. `skipped`
 * covers the two ways that happens, and both are configuration rather than bad
 * luck: no runner is installed, or none of the installed ones answers for that
 * competition. Putting it back as pending instead would retry it at the poll
 * interval forever, which is what the queue did before there was a claim at all.
 */
export const settleStatus = (
  statusNow: string,
  outcome: { status?: string } | undefined,
  running: string,
  skipped: string,
): string | undefined => {
  if (statusNow !== running) return undefined;
  const reported = outcome?.status;
  if (reported === undefined || reported === running) return skipped;
  return reported;
};

/**
 * Run every item, never more than `limit` at a time.
 *
 * `Promise.all` over the whole pending list is what this replaces. That starts
 * one container per queued job simultaneously, so forty submissions near a
 * deadline is forty containers, and the memory limit each one respects
 * individually says nothing about what forty of them do to the host.
 *
 * Workers pull from a shared cursor rather than taking a fixed slice each,
 * because evaluations are not equal in length and a static split leaves workers
 * idle while one of them grinds through the slow half.
 */
export const mapWithLimit = async <T>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<void>,
): Promise<void> => {
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const index = cursor++;
      const item = items[index];
      if (index >= items.length || item === undefined) return;
      await run(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
};
