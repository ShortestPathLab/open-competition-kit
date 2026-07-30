/**
 * A competition's schedule, derived from the windows its tracks declare.
 *
 * Nothing in the config gives a competition an `opensAt` or a `closesAt`. Only
 * `TrackConfig` carries those, because only a track accepts submissions, so a
 * competition-level deadline has to be read off the tracks underneath it.
 *
 * Free of imports beyond the window reasoning itself, for the same reason
 * `core/config/window` is: this runs in the browser on every tick.
 */
import {
  windowStateAt,
  type SubmissionWindow,
  type WindowState,
} from "@open-competition-kit/sdk/window";

export type TrackWindow = SubmissionWindow & { id: string; name: string };

export type Milestone = {
  /** Stable across renders so React can keep rows identified. */
  key: string;
  kind: "opens" | "closes";
  /** Already phrased for display: "Opens", "Closes", "Main Track closes". */
  label: string;
  at: string;
  past: boolean;
};

export type CompetitionSchedule = {
  /** The competition read as one window. See `competitionWindow` for the rules. */
  window: SubmissionWindow;
  state: WindowState;
  /** What a countdown should run down to. Absent once nothing is left ahead. */
  countdown?: { label: string; at: string };
  milestones: Milestone[];
};

/**
 * The competition as a single window.
 *
 * A bound only counts when every track sets it. One track with no `opensAt` has
 * been open since the beginning of time, which makes the competition open too,
 * so reporting the earliest declared opening would date something that never
 * happened. The same argument runs the other way for `closesAt`: a track that
 * never closes keeps the competition from ever closing.
 */
export function competitionWindow(
  tracks: readonly TrackWindow[],
): SubmissionWindow {
  if (!tracks.length) return {};

  const opens = tracks.map((track) => track.opensAt);
  const closes = tracks.map((track) => track.closesAt);

  return {
    opensAt:
      opens.every(Boolean) ?
        opens.reduce((first, at) =>
          Date.parse(at!) < Date.parse(first!) ? at : first,
        )
      : undefined,
    closesAt:
      closes.every(Boolean) ?
        closes.reduce((last, at) =>
          Date.parse(at!) > Date.parse(last!) ? at : last,
        )
      : undefined,
  };
}

/** Instants of one kind, each mapped to the tracks that share it. */
function boundsByInstant(
  tracks: readonly TrackWindow[],
  kind: Milestone["kind"],
) {
  const byInstant = new Map<string, TrackWindow[]>();
  for (const track of tracks) {
    const at = kind === "opens" ? track.opensAt : track.closesAt;
    if (!at) continue;
    byInstant.set(at, [...(byInstant.get(at) ?? []), track]);
  }
  return byInstant;
}

function milestonesFor(
  tracks: readonly TrackWindow[],
  kind: Milestone["kind"],
  now: number,
): Milestone[] {
  const verb = kind === "opens" ? "opens" : "closes";

  return [...boundsByInstant(tracks, kind)].map(([at, sharing]) => {
    const past = now >= Date.parse(at);
    // A bound every track shares belongs to the competition, so it is named
    // without qualification. Anything narrower has to say whose deadline it is,
    // or two rows a week apart read as a contradiction.
    const label =
      sharing.length === tracks.length ?
        past ?
          kind === "opens" ? "Opened"
          : "Closed"
        : kind === "opens" ? "Opens"
        : "Closes"
      : sharing.length === 1 ? `${sharing[0]!.name} ${verb}`
      : `${sharing.length} tracks ${verb}`;

    return { key: `${kind}:${at}`, kind, label, at, past };
  });
}

/**
 * Everything the deadline panel needs, or `undefined` when no track schedules
 * anything and the panel should not render at all.
 */
export function competitionSchedule(
  tracks: readonly TrackWindow[],
  now: number,
): CompetitionSchedule | undefined {
  const scheduled = tracks.filter((track) => track.opensAt || track.closesAt);
  if (!scheduled.length) return undefined;

  const window = competitionWindow(tracks);
  const state = windowStateAt(window, now);

  const milestones = [
    ...milestonesFor(tracks, "opens", now),
    ...milestonesFor(tracks, "closes", now),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  return { window, state, countdown: countdownTo(tracks, state, now), milestones };
}

/**
 * The next boundary worth counting down to.
 *
 * Before the competition opens that is the opening. Afterwards it is the
 * *earliest* deadline still ahead, not the last one: with one track closing on
 * Friday and another a month later, Friday is the number a competitor needs.
 */
function countdownTo(
  tracks: readonly TrackWindow[],
  state: WindowState,
  now: number,
): CompetitionSchedule["countdown"] {
  if (state.status === "upcoming") {
    return { label: "Opens in", at: state.opensAt };
  }

  const ahead = tracks
    .map((track) => track.closesAt)
    .filter((at): at is string => !!at && Date.parse(at) > now)
    .sort((a, b) => Date.parse(a) - Date.parse(b));

  const next = ahead[0];
  if (!next) return undefined;

  // Tracks that close at different times have no single deadline to name, and
  // the milestone list below already spells out which one this is.
  const label =
    ahead.every((at) => at === next) && ahead.length === tracks.length ?
      "Submissions close in"
    : "Next deadline in";

  return { label, at: next };
}

export type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

/**
 * A duration as the one unit worth reading: "3 days", "5 hours", "40 minutes".
 *
 * A list of tracks needs the distance to a deadline, not the deadline itself,
 * and it needs it short enough to sit in a column. The exact instant stays
 * beside it for anyone who wants to check.
 */
export function describeDuration(ms: number): string {
  const { days, hours, minutes } = splitRemaining(ms);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"}`;
  if (minutes >= 1) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return "under a minute";
}

export function splitRemaining(ms: number): Remaining {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}
