/**
 * A competition's schedule, derived from what its tracks report.
 *
 * Nothing in the config dates a competition. Only a track takes submissions, so
 * competition-level dates are read off the tracks below it, and those tracks get
 * their dates from whichever package gates them. Working over gate reports rather
 * than windows means the same code builds a countdown out of closing dates, quota
 * resets, or whatever a package installed next year reports. Kept free of heavy
 * imports because this runs in the browser on every tick.
 */
import { worstOf, type GateReport } from "@open-competition-kit/sdk/gate";
import { groupBy, maxBy, minBy, sortBy } from "es-toolkit";

export {
  describeDuration,
  splitRemaining,
  type Remaining,
} from "@open-competition-kit/sdk/instant";

/** A track, and what the installed gates say about it. */
export type TrackReports = {
  id: string;
  name: string;
  reports: readonly GateReport[];
};

/**
 * How much a track is in the way, as one word.
 *
 * `closing` is not a state any rule has. It is what a gate reports when it wants
 * attention without refusing yet, so that a track with two days left and one with
 * two months left are not the same colour.
 *
 * A blocked track splits on whether anything it reported is still ahead. A future
 * instant means it is waiting on something (it opens on Monday, the quota frees at
 * 11:40); no instant means it is finished.
 */
export type Phase = "open" | "closing" | "upcoming" | "closed";

const futureInstants = (reports: readonly GateReport[], now: number) =>
  sortBy(
    reports.filter((report) => report.at && Date.parse(report.at) > now),
    [(report) => Date.parse(report.at!)],
  );

export function phaseOf(reports: readonly GateReport[], now: number): Phase {
  switch (worstOf(reports)) {
    case "ok":
      return "open";
    case "pending":
      return "closing";
    case "blocked":
      return futureInstants(reports, now).length ? "upcoming" : "closed";
  }
}

/** Whether a competitor can act on this track right now. */
export const isActionable = (phase: Phase) => phase === "open" || phase === "closing";

export type Milestone = {
  /** Stable across renders so React can keep rows identified. */
  key: string;
  /** Already phrased for display: "Opens", "Closes", "Main Track closes". */
  label: string;
  at: string;
  past: boolean;
  /** The worst state among the reports that share this instant. */
  state: GateReport["state"];
};

export type CompetitionSchedule = {
  /**
   * The competition as one state. `open` when any track is, since a competition
   * with one track still accepting work has not closed. `upcoming` when every
   * track is blocked and something is still ahead, `closed` when nothing is.
   */
  status: "open" | "upcoming" | "closed";
  /** What a countdown should run down to. Absent once nothing is left ahead. */
  countdown?: { label: string; at: string };
  milestones: Milestone[];
};

type Dated = { track: TrackReports; report: GateReport; at: string };

const datedReports = (tracks: readonly TrackReports[]): Dated[] =>
  tracks.flatMap((track) =>
    track.reports
      .filter((report) => report.at)
      .map((report) => ({ track, report, at: report.at! })),
  );

/**
 * What makes two dated reports the same event: the gate they came from, what
 * happens at the instant, and the instant itself. Two tracks closing at the same
 * moment is one date. A track closing exactly when another opens is two, and the
 * gate id alone cannot tell those apart since both are the same gate speaking.
 */
const eventKey = (entry: Dated) => `${entry.report.gate}:${entry.report.atLabel ?? ""}:${entry.at}`;

const SEVERITY = { ok: 0, pending: 1, blocked: 2 } as const;

/**
 * Everything the deadline panel needs, or `undefined` when no track reports a
 * date at all and the panel should not render.
 */
export function competitionSchedule(
  tracks: readonly TrackReports[],
  now: number,
): CompetitionSchedule | undefined {
  const dated = datedReports(tracks);
  if (!dated.length) return undefined;

  const milestones = sortBy(
    Object.entries(groupBy(dated, eventKey)).map(([key, sharing]) => {
      const first = sharing[0]!;
      const name = first.report.atLabel ?? first.report.label;

      // A date every track shares belongs to the competition, so it is named
      // without qualification. Anything narrower has to say whose date it is, or
      // two rows a week apart read as a contradiction.
      const label =
        sharing.length === tracks.length
          ? name
          : sharing.length === 1
            ? `${first.track.name} ${name.toLowerCase()}`
            : `${sharing.length} tracks ${name.toLowerCase()}`;

      return {
        key,
        label,
        at: first.at,
        past: now >= Date.parse(first.at),
        state: maxBy(sharing, (entry) => SEVERITY[entry.report.state])!.report.state,
      };
    }),
    [(milestone) => Date.parse(milestone.at)],
  );

  return {
    status: statusOf(tracks, now),
    countdown: countdownTo(tracks, dated, now),
    milestones,
  };
}

/**
 * One open track keeps the competition open.
 *
 * A competition-level bound counts only when every track sets one, because a
 * track that never closes keeps the competition from closing. Stated over states
 * rather than dates, which makes it true of any gate rather than only of a window.
 */
function statusOf(tracks: readonly TrackReports[], now: number): CompetitionSchedule["status"] {
  const phases = tracks.map((track) => phaseOf(track.reports, now));
  if (phases.some(isActionable)) return "open";
  return phases.some((phase) => phase === "upcoming") ? "upcoming" : "closed";
}

/**
 * The next instant worth counting down to: the soonest still ahead, not the last.
 * With one track closing on Friday and another a month later, Friday is the number
 * a competitor needs. Named without qualification only when every track shares it,
 * since "Closes in" over a date belonging to one track out of four is a lie the
 * milestone list then contradicts.
 */
function countdownTo(
  tracks: readonly TrackReports[],
  dated: readonly Dated[],
  now: number,
): CompetitionSchedule["countdown"] {
  const ahead = dated.filter((entry) => Date.parse(entry.at) > now);
  const next = minBy(ahead, (entry) => Date.parse(entry.at));
  if (!next) return undefined;

  const sharing = ahead.filter((entry) => eventKey(entry) === eventKey(next));
  const name = next.report.atLabel ?? next.report.label;
  const label = sharing.length === tracks.length ? `${name} in` : "Next deadline in";

  return { label, at: next.at };
}
