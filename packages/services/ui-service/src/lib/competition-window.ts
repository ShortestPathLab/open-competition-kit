/**
 * A competition's schedule, derived from what its tracks report.
 *
 * Nothing in the config gives a competition a date. Only a track takes
 * submissions, so a competition-level deadline has to be read off the tracks
 * underneath it, and the tracks themselves get their dates from whichever
 * package gates them.
 *
 * That last part is why none of this mentions a window any more. A report has a
 * state, a label and possibly an instant; the same code builds a countdown out of
 * closing dates, quota resets, or whatever a package installed next year decides
 * to report. Free of heavy imports for the same reason it always was: this runs
 * in the browser on every tick.
 */
import { worstOf, type GateReport } from "@open-competition-kit/sdk/gate";

export { describeDuration, splitRemaining, type Remaining } from "@open-competition-kit/sdk/instant";

/** A track, and what the installed gates say about it. */
export type TrackReports = {
  id: string;
  name: string;
  reports: readonly GateReport[];
};

/**
 * How much a track is in the way, as one word.
 *
 * `closing` is the interesting one. It is not a state any rule has; it is what a
 * gate reports when it wants attention without refusing yet, and it exists
 * because a track with two days left and a track with two months left are
 * otherwise the same colour.
 *
 * A blocked track splits by whether anything it reported is still ahead. One with
 * a future instant is waiting on something (it opens on Monday, the quota frees
 * at 11:40); one without is finished. That is the same distinction the old code
 * drew between `upcoming` and `closed`, reached without knowing what either word
 * meant.
 */
export type Phase = "open" | "closing" | "upcoming" | "closed";

const futureInstants = (reports: readonly GateReport[], now: number) =>
  reports
    .filter((report) => report.at && Date.parse(report.at) > now)
    .sort((a, b) => Date.parse(a.at!) - Date.parse(b.at!));

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
export const isActionable = (phase: Phase) =>
  phase === "open" || phase === "closing";

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
   * The competition as one state.
   *
   * `open` when any track is, because a competition with one track still
   * accepting work has not closed. `upcoming` when every track is blocked and
   * something is still ahead, `closed` when every track is blocked and nothing
   * is.
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
 * What makes two dated reports the same event.
 *
 * The gate they came from, what happens at the instant, and the instant itself.
 * Two tracks closing at the same moment is one date; a track closing exactly
 * when another opens is two, and the gate id alone cannot tell those apart since
 * both are the same gate speaking.
 */
const eventKey = (entry: Dated) =>
  `${entry.report.gate}:${entry.report.atLabel ?? ""}:${entry.at}`;

const byEvent = (dated: readonly Dated[]) => {
  const groups = new Map<string, Dated[]>();
  for (const entry of dated) {
    const key = eventKey(entry);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return groups;
};

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

  const milestones = [...byEvent(dated)]
    .map(([key, sharing]) => {
      const first = sharing[0]!;
      const name = first.report.atLabel ?? first.report.label;

      // A date every track shares belongs to the competition, so it is named
      // without qualification. Anything narrower has to say whose date it is, or
      // two rows a week apart read as a contradiction.
      const label =
        sharing.length === tracks.length ? name
        : sharing.length === 1 ?
          `${sharing[0]!.track.name} ${name.toLowerCase()}`
        : `${sharing.length} tracks ${name.toLowerCase()}`;

      return {
        key,
        label,
        at: first.at,
        past: now >= Date.parse(first.at),
        state: sharing.reduce<GateReport["state"]>(
          (worst, entry) =>
            SEVERITY[entry.report.state] > SEVERITY[worst] ?
              entry.report.state
            : worst,
          "ok",
        ),
      };
    })
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  return {
    status: statusOf(tracks, now),
    countdown: countdownTo(tracks, dated, now),
    milestones,
  };
}

/**
 * One track open keeps the competition open.
 *
 * The old rule said a competition-level bound counts only when every track sets
 * one, because a track that never closes keeps the competition from closing.
 * This is that rule restated over states rather than over dates, which makes it
 * true of any gate rather than only of a window.
 */
function statusOf(
  tracks: readonly TrackReports[],
  now: number,
): CompetitionSchedule["status"] {
  const phases = tracks.map((track) => phaseOf(track.reports, now));
  if (phases.some(isActionable)) return "open";
  return phases.some((phase) => phase === "upcoming") ? "upcoming" : "closed";
}

/**
 * The next instant worth counting down to.
 *
 * The soonest one still ahead, not the last: with one track closing on Friday
 * and another a month later, Friday is the number a competitor needs. It is named
 * without qualification only when every track shares it, since "Closes in" over a
 * date that belongs to one track out of four is a lie the milestone list below
 * then contradicts.
 */
function countdownTo(
  tracks: readonly TrackReports[],
  dated: readonly Dated[],
  now: number,
): CompetitionSchedule["countdown"] {
  const ahead = dated
    .filter((entry) => Date.parse(entry.at) > now)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const next = ahead[0];
  if (!next) return undefined;

  const sharing = ahead.filter(
    (entry) => eventKey(entry) === eventKey(next),
  );

  const name = next.report.atLabel ?? next.report.label;
  const label =
    sharing.length === tracks.length ? `${name} in` : "Next deadline in";

  return { label, at: next.at };
}
