import {
  describeDuration,
  formatInstant,
  type GateReport,
  type Refusal,
} from "@open-competition-kit/sdk";
import type { GatedTrack } from "../config";
import { describeWindowState, windowStateAt } from "../window";
import { CLOSING_SOON_MS } from "./shared";

/** Refuses outside the track's `opensAt`/`closesAt` window. */
export const windowGate = (track: GatedTrack, now: number): Refusal[] => {
  const state = windowStateAt(track, now);
  if (state.status === "open") return [];

  return [
    {
      gate: "window",
      reason: describeWindowState(state),
      detail:
        state.status === "upcoming" ?
          { opensAt: state.opensAt }
        : { closesAt: state.closesAt },
    },
  ];
};

/**
 * The window as something to draw, which needs an answer even when it is open.
 *
 * An open window with a deadline still reports it, because that is what a countdown
 * runs against and what a competition-wide schedule is built from. A track with
 * neither bound reports nothing rather than "always open": an empty list is how a
 * host knows there is no schedule to show, and a row saying "Open" forever is noise.
 */
export const windowReport = (track: GatedTrack, now: number): GateReport[] => {
  if (!track.opensAt && !track.closesAt) return [];

  const state = windowStateAt(track, now);

  if (state.status === "upcoming") {
    return [
      {
        gate: "window",
        state: "blocked",
        label: "Upcoming",
        detail: `Opens in ${describeDuration(Date.parse(state.opensAt) - now)}, on ${formatInstant(state.opensAt)}.`,
        at: state.opensAt,
        atLabel: "Opens",
        data: { bound: "opensAt", opensAt: state.opensAt },
      },
    ];
  }

  if (state.status === "closed") {
    return [
      {
        gate: "window",
        state: "blocked",
        label: "Closed",
        detail: `Closed on ${formatInstant(state.closesAt)}.`,
        at: state.closesAt,
        atLabel: "Closed",
        data: { bound: "closesAt", closesAt: state.closesAt },
      },
    ];
  }

  if (!track.closesAt) {
    return [
      {
        gate: "window",
        state: "ok",
        label: "Open",
        detail: "No closing date.",
        data: { bound: "opensAt" },
      },
    ];
  }

  const remaining = Date.parse(track.closesAt) - now;
  const soon = remaining <= CLOSING_SOON_MS;

  return [
    {
      gate: "window",
      state: soon ? "pending" : "ok",
      label: soon ? "Closes soon" : "Open",
      detail: `Closes in ${describeDuration(remaining)}, on ${formatInstant(track.closesAt)}.`,
      at: track.closesAt,
      atLabel: "Closes",
      data: { bound: "closesAt", closesAt: track.closesAt },
    },
  ];
};
