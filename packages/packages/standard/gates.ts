import {
  describeDuration,
  formatInstant,
  submissions,
  tracks,
  unsafe,
  type GateReport,
  type Refusal,
  type Submission,
} from "@open-competition-kit/sdk";
import { gatedTrack, type GatedTrack } from "./config";
import { describeWindowState, windowStateAt } from "./window";

/**
 * How close to a deadline a track starts reading as closing rather than open.
 *
 * Not a state the rules have: a window is open until it is not. It exists
 * because a track with two days left and a track with two months left are
 * otherwise the same colour, and only one of them needs you today.
 */
export const CLOSING_SOON_MS = 3 * 24 * 60 * 60 * 1000;

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * "hour" and "day" rather than "60 minutes" and "1440 minutes", because that is
 * how the rule was meant when it was written down.
 */
const describeWindow = (minutes: number) => {
  if (minutes === 60) return "hour";
  if (minutes === 1440) return "day";
  if (minutes % 1440 === 0) return plural(minutes / 1440, "day");
  if (minutes % 60 === 0) return plural(minutes / 60, "hour");
  return plural(minutes, "minute");
};

/**
 * The track's gate config, parsed by the schema this package declares.
 *
 * Every field is optional and every one of them is off when absent, so a track
 * that configures none of this behaves exactly as it did before gates existed.
 * Parsing rather than casting means the values here have been through the same
 * check that ran at boot, including the `Date` normalisation a YAML timestamp
 * needs.
 */
const gatesOf = async (track: string): Promise<GatedTrack> => {
  const def = await unsafe(tracks.get(track));
  const parsed = gatedTrack.safeParse(def);
  // Boot already rejected an invalid track, so a failure here means the record
  // came from somewhere else entirely. Treat it as a track with no gates rather
  // than throwing, since throwing inside the chain fails the submission closed
  // for a reason the competitor cannot act on.
  return parsed.success ? parsed.data : {};
};

/** Whether either quota needs the competitor's submission history to answer. */
const needsHistory = (def: GatedTrack) =>
  def.maxSubmissions != null || def.rateLimit != null;

const historyFor = async (user: string | undefined, track: string) =>
  user ? await unsafe(submissions.list({ user, track })) : [];

// ─── Window ──────────────────────────────────────────────

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
 * An open window with a deadline still reports the deadline, because that is the
 * one a countdown runs against and the one a competition-wide schedule is built
 * from. A track with neither bound reports nothing at all rather than "always
 * open": an empty list is how a host knows there is no schedule to show, and a
 * row saying "Open" forever is noise in a table.
 */
export const windowReport = (
  track: GatedTrack,
  now: number,
): GateReport[] => {
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

// ─── Attempts ────────────────────────────────────────────

/** Refuses once a competitor has spent every attempt the track allows. */
export const attemptsGate = (
  track: GatedTrack,
  mine: Submission[],
): Refusal[] => {
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
 * Only reported to the competitor it is about. Asked without a user, the ceiling
 * is still worth stating, since "3 submissions each" is a rule of the track and
 * not a fact about anybody in particular.
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
      state:
        left === 0 ? "blocked"
        : left <= 1 ? "pending"
        : "ok",
      label:
        left === 0 ? "No attempts left"
        : `${plural(left, "attempt")} left`,
      detail: `You have used ${mine.length} of ${plural(max, "submission")}.`,
      data: { used: mine.length, max, left },
    },
  ];
};

// ─── Rate ────────────────────────────────────────────────

/** Submission times inside the rolling window, oldest first. */
const inWindow = (
  mine: Submission[],
  windowMinutes: number,
  now: number,
) => {
  const windowMs = windowMinutes * 60_000;
  return mine
    .map((submission) => submission.createdAt.getTime())
    .filter((at) => at > now - windowMs)
    .sort((a, b) => a - b);
};

/**
 * Refuses when too many submissions land inside a rolling window.
 *
 * The window slides: it is measured backwards from now, so the slot that frees
 * up next is the one held by the oldest submission still inside it. That instant
 * is worth returning, since "try again later" without a time is not an answer.
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

// ─── Chains ──────────────────────────────────────────────

/**
 * Every refusal this package has for one competitor on one track.
 *
 * The submission history is fetched once and shared by the two gates that need
 * it, and not fetched at all when neither is configured. That matters more than
 * it looks: this runs on every submission and again every time a form renders,
 * and `Submission` carries no index on `(user, track)`.
 */
export async function standardRefusals(
  user: string,
  track: string,
  now: number,
): Promise<Refusal[]> {
  const def = await gatesOf(track);
  const mine = needsHistory(def) ? await historyFor(user, track) : [];

  return [
    ...windowGate(def, now),
    ...attemptsGate(def, mine),
    ...rateGate(def, mine, now),
  ];
}

/**
 * The same three rules, said out loud whether or not they are refusing.
 *
 * Shares `gatesOf` and the history fetch with `standardRefusals` rather than
 * being derived from it, which keeps the enforcement path free to be strict and
 * uncached while this one is asked once per track in a list.
 *
 * With no user the per-competitor quotas are reported as rules of the track
 * instead of as facts about a reader, and no history is fetched at all.
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
