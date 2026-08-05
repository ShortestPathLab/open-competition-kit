import type { GateReport } from "@open-competition-kit/sdk/gate";
import type { EnrolmentSummary, TrackSummary } from "./competition-data";
import { describeDuration, isActionable, phaseOf, type Phase } from "./competition-window";

export type TrackWithReports = TrackSummary & { reports: GateReport[] };

/** One row of the tracks list: the track, where it is, and your part in it. */
export type TrackRow = {
  track: TrackWithReports;
  phase: Phase;
  /**
   * `undefined` is "not enrolled", which is not the same as having enrolled and
   * sent nothing.
   */
  submissions: number | undefined;
};

export type TrackFilter = "all" | "open" | "entered";

/**
 * The groups a list of tracks divides into, in the order they matter.
 *
 * "Not open yet" rather than "Opens later", because a track can be blocked by
 * something other than a start date. A competitor who has spent their hourly
 * quota lands here too, and the card underneath says which it is.
 */
export const SECTIONS: Array<{
  key: string;
  label: string;
  phases: Phase[];
}> = [
  { key: "now", label: "Open now", phases: ["closing", "open"] },
  { key: "later", label: "Not open yet", phases: ["upcoming"] },
  { key: "closed", label: "Closed", phases: ["closed"] },
];

/** The soonest instant a track reports, or nothing, which sorts last. */
export const soonestOf = (reports: readonly { at?: string }[]) => {
  const instants = reports
    .map((report) => (report.at ? Date.parse(report.at) : undefined))
    .filter((at): at is number => at !== undefined);
  return instants.length ? Math.min(...instants) : Number.POSITIVE_INFINITY;
};

/** How many submissions the reader has sent to each track of one competition. */
export const submissionCountsByTrack = (
  enrolments: readonly EnrolmentSummary[],
  competitionId: string,
) =>
  new Map(
    enrolments
      .filter((enrolment) => enrolment.competition.id === competitionId)
      .map((enrolment) => [enrolment.track.id, enrolment.submissions.length]),
  );

export const buildRows = (
  tracks: readonly TrackWithReports[],
  submissionsByTrack: ReadonlyMap<string, number>,
  now: number,
): TrackRow[] =>
  tracks.map((track) => ({
    track,
    phase: phaseOf(track.reports, now),
    submissions: submissionsByTrack.get(track.id),
  }));

/**
 * The soonest instant any actionable track is counting down to.
 *
 * Reads whatever the gates reported rather than a closing date specifically, so
 * a competition whose tracks are paced by something else still gets a number in
 * the header.
 */
export const nextDeadlineOf = (rows: readonly TrackRow[], now: number) => {
  const instants = rows
    .filter((row) => isActionable(row.phase))
    .flatMap((row) => row.track.reports)
    .map((report) => report.at)
    .filter((at): at is string => Boolean(at))
    .map((at) => Date.parse(at))
    .filter((at) => at > now)
    .sort((a, b) => a - b);

  return instants.length ? describeDuration(instants[0]! - now) : undefined;
};

export const filterRows = (rows: readonly TrackRow[], filter: TrackFilter, search: string) => {
  const query = search.trim().toLowerCase();

  return rows.filter((row) => {
    if (filter === "open" && !isActionable(row.phase)) return false;
    if (filter === "entered" && row.submissions === undefined) return false;
    if (!query) return true;
    return `${row.track.name} ${row.track.description}`.toLowerCase().includes(query);
  });
};

/** The visible rows, grouped and ordered, with empty groups dropped. */
export const sectionRows = (visible: readonly TrackRow[]) =>
  SECTIONS.map((section) => ({
    ...section,
    // Soonest date first inside a section, so the track that needs you today
    // sits at the top of the page.
    rows: visible
      .filter((row) => section.phases.includes(row.phase))
      .sort((a, b) => soonestOf(a.track.reports) - soonestOf(b.track.reports)),
  })).filter((section) => section.rows.length > 0);
