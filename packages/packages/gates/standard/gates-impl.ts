import type { GateReport, Refusal } from "@open-competition-kit/sdk";
import { attemptsGate, attemptsReport } from "./gates/attempts";
import { rateGate, rateReport } from "./gates/rate";
import { gatesOf, historyFor, needsHistory } from "./gates/shared";
import { windowGate, windowReport } from "./gates/window";

export * from "./gates/shared";
export * from "./gates/window";
export * from "./gates/attempts";
export * from "./gates/rate";

/**
 * Every refusal this package has for one competitor on one track.
 *
 * The submission history is fetched once and shared by the two gates that need it,
 * and not fetched at all when neither is configured. That matters more than it
 * looks: this runs on every submission and again every time a form renders, and
 * `Submission` carries no index on `(user, track)`.
 */
export async function standardRefusals(
  user: string,
  track: string,
  now: number,
): Promise<Refusal[]> {
  const def = await gatesOf(track);
  const mine = needsHistory(def) ? await historyFor(user, track) : [];

  return [...windowGate(def, now), ...attemptsGate(def, mine), ...rateGate(def, mine, now)];
}

/**
 * The same three rules, said out loud whether or not they are refusing.
 *
 * Shares `gatesOf` and the history fetch with `standardRefusals` rather than being
 * derived from it, which keeps the enforcement path free to be strict and uncached
 * while this one is asked once per track in a list.
 *
 * With no user the per-competitor quotas are reported as rules of the track instead
 * of as facts about a reader, and no history is fetched at all.
 */
export async function standardReports(
  track: string,
  user: string | undefined,
  now: number,
): Promise<GateReport[]> {
  const def = await gatesOf(track);
  const known = !!user && needsHistory(def);
  const mine = known ? await historyFor(user, track) : [];

  return [
    ...windowReport(def, now),
    ...attemptsReport(def, mine, known),
    ...rateReport(def, mine, now, known),
  ];
}
