import {
  formatInstant,
  type GateReport,
  type Refusal,
  type Submission,
} from "@open-competition-kit/sdk";
import type { GatedTrack } from "../config";
import { describeWindow, plural } from "./shared";

/** Submission times inside the rolling window, oldest first. */
const inWindow = (mine: Submission[], windowMinutes: number, now: number) => {
  const windowMs = windowMinutes * 60_000;
  return mine
    .map((submission) => submission.createdAt.getTime())
    .filter((at) => at > now - windowMs)
    .sort((a, b) => a - b);
};

/**
 * Refuses when too many submissions land inside a rolling window.
 *
 * The window slides: it is measured backwards from now, so the slot that frees up
 * next is the one held by the oldest submission still inside it. That instant is
 * worth returning, since "try again later" without a time is not an answer.
 */
export const rateGate = (
  track: GatedTrack,
  mine: Submission[],
  now: number,
): Refusal[] => {
  const limit = track.rateLimit;
  if (!limit) return [];

  const recent = inWindow(mine, limit.windowMinutes, now);
  if (recent.length < limit.count) return [];

  const retryAt = new Date(
    recent[0]! + limit.windowMinutes * 60_000,
  ).toISOString();

  return [
    {
      gate: "rate",
      reason:
        `You may make ${plural(limit.count, "submission")} every ` +
        `${describeWindow(limit.windowMinutes)}. You can submit again from ` +
        `${formatInstant(retryAt)}.`,
      detail: {
        used: recent.length,
        count: limit.count,
        windowMinutes: limit.windowMinutes,
        retryAt,
      },
    },
  ];
};

export const rateReport = (
  track: GatedTrack,
  mine: Submission[],
  now: number,
  known: boolean,
): GateReport[] => {
  const limit = track.rateLimit;
  if (!limit) return [];

  const rule = `${plural(limit.count, "submission")} every ${describeWindow(limit.windowMinutes)}`;

  if (!known) {
    return [{ gate: "rate", state: "ok", label: rule, data: { ...limit } }];
  }

  const recent = inWindow(mine, limit.windowMinutes, now);
  const spent = recent.length >= limit.count;
  const retryAt =
    spent ?
      new Date(recent[0]! + limit.windowMinutes * 60_000).toISOString()
    : undefined;

  return [
    {
      gate: "rate",
      state: spent ? "blocked" : "ok",
      label: spent ? "Rate limited" : rule,
      detail:
        retryAt ?
          `You may make ${rule}. You can submit again from ${formatInstant(retryAt)}.`
        : `You have made ${recent.length} of ${limit.count} in the last ${describeWindow(limit.windowMinutes)}.`,
      at: retryAt,
      ...(retryAt ? { atLabel: "Next attempt" } : {}),
      data: {
        used: recent.length,
        count: limit.count,
        windowMinutes: limit.windowMinutes,
        ...(retryAt ? { retryAt } : {}),
      },
    },
  ];
};
