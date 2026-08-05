import type { GateReport, Refusal, Submission } from "@open-competition-kit/sdk";
import type { GatedTrack } from "../config";
import { plural } from "./shared";

/** Refuses once a competitor has spent every attempt the track allows. */
export const attemptsGate = (track: GatedTrack, mine: Submission[]): Refusal[] => {
  const max = track.maxSubmissions;
  if (!max || mine.length < max) return [];

  return [
    {
      gate: "attempts",
      reason: `You have used all ${plural(max, "submission")} for this track.`,
      detail: { used: mine.length, max },
    },
  ];
};

/**
 * How much of the ceiling is left, which is worth saying long before it is gone.
 *
 * Only reported to the competitor it is about. Asked without a user, the ceiling is
 * still worth stating, since "3 submissions each" is a rule of the track and not a
 * fact about anybody in particular.
 */
export const attemptsReport = (
  track: GatedTrack,
  mine: Submission[],
  known: boolean,
): GateReport[] => {
  const max = track.maxSubmissions;
  if (!max) return [];

  if (!known) {
    return [
      {
        gate: "attempts",
        state: "ok",
        label: `${plural(max, "submission")} each`,
        data: { max },
      },
    ];
  }

  const left = Math.max(0, max - mine.length);

  return [
    {
      gate: "attempts",
      state: left === 0 ? "blocked" : left <= 1 ? "pending" : "ok",
      label: left === 0 ? "No attempts left" : `${plural(left, "attempt")} left`,
      detail: `You have used ${mine.length} of ${plural(max, "submission")}.`,
      data: { used: mine.length, max, left },
    },
  ];
};
