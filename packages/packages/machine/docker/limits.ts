/**
 * Holding a run to the organiser's ceiling.
 *
 * Pure, and kept apart from the code that talks to Docker, because this is the
 * part with a wrong answer: it decides how much of the host a stranger's code
 * gets, and it should be readable and testable without a daemon anywhere near
 * it.
 */
import type { MachineCeiling } from "./config";

export type Confinement = {
  timeoutMs?: number;
  limits?: {
    memoryMb?: number;
    cpus?: number;
    pids?: number;
    network?: boolean;
    writable?: boolean;
  };
};

/**
 * The smaller of what was asked for and what is allowed.
 *
 * An absent ceiling leaves the ask alone. An absent ask takes the ceiling, which
 * is the case worth being deliberate about: a runner that never mentions `cpus`
 * should still be held to a configured CPU limit. Treating the ceiling as a
 * maximum only would leave the field unbounded in exactly the case where nobody
 * was paying attention to it.
 */
export const atMost = (
  ask: number | undefined,
  ceiling: number | undefined,
): number | undefined => {
  if (ask === undefined) return ceiling;
  if (ceiling === undefined) return ask;
  return Math.min(ask, ceiling);
};

/**
 * A permission the organiser can withhold.
 *
 * `false` denies it whatever the runner asked for. Anything else leaves the ask
 * standing, so `network: true` in a config reads as "a runner may turn this on"
 * rather than as "network on", which is what it has to mean: these two are off
 * unless the run asks, and the ceiling only decides whether asking works.
 */
export const permitted = (
  ask: boolean | undefined,
  ceiling: boolean | undefined,
): boolean | undefined => (ceiling === false ? false : ask);

/**
 * A run's confinement, held to the ceiling.
 *
 * Returns only the fields it decides, for the caller to lay over the request.
 * Every field this package acts on goes through here, the two booleans included:
 * a ceiling a runner can step around by setting `network: true` is not a
 * ceiling, and leaving those out would have made the numbers look stronger than
 * the arrangement really was.
 */
export const clamp = (request: Confinement, ceiling: MachineCeiling): Confinement => ({
  timeoutMs: atMost(request.timeoutMs, ceiling.timeoutMs),
  limits: {
    memoryMb: atMost(request.limits?.memoryMb, ceiling.memoryMb),
    cpus: atMost(request.limits?.cpus, ceiling.cpus),
    pids: atMost(request.limits?.pids, ceiling.pids),
    network: permitted(request.limits?.network, ceiling.network),
    writable: permitted(request.limits?.writable, ceiling.writable),
  },
});
