import { useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { useDeferredValue, useMemo, useState } from "react";
import { z } from "zod";
import { authClient } from "./auth-client";
import { getCompetitionSummary, type TrackSummary } from "./competition-data";
import { useCompetition } from "./competition-fn";
import { isActionable } from "./competition-window";
import { useUserEnrolments } from "./enrolment-fn";
import { useTracksWithReports } from "./gate-fn";
import {
  buildRows,
  filterRows,
  nextDeadlineOf,
  sectionRows,
  submissionCountsByTrack,
  type TrackFilter,
} from "./track-list";

const getTracks = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    return (await getCompetitionSummary(id)).tracks;
  });

/**
 * The tracks list, with the reader's own history folded into it.
 *
 * Search and filter live here rather than in the page because the counts beside
 * each filter button are derived from the same rows the filter narrows, and
 * splitting the state from the derivation puts two sources of truth one render
 * apart.
 */
export function useTrackList(competitionId: string) {
  const { data: competition } = useCompetition(competitionId);
  const { data: session } = authClient.useSession();
  const fetchTracks = useServerFn(getTracks);
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["competitionTracks", competitionId],
    queryFn: () => (fetchTracks as any)({ data: competitionId }),
  });
  // The reader's enrolments, asked for once for the whole list rather than once
  // per row. The track page already runs this query, so it is usually warm.
  const { data: enrolments = [] } = useUserEnrolments(session?.user?.id);
  // What the installed gates say about each track: the pill, the sort order and
  // the section a row lands in all come from here.
  const withReports = useTracksWithReports(
    tracks as TrackSummary[],
    session?.user?.id,
  );

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TrackFilter>("all");
  const deferredSearch = useDeferredValue(search);

  const rows = useMemo(
    () =>
      buildRows(
        withReports,
        submissionCountsByTrack(enrolments, competitionId),
        Date.now(),
      ),
    [enrolments, competitionId, withReports],
  );

  const nextDeadline = useMemo(() => nextDeadlineOf(rows, Date.now()), [rows]);

  const visible = useMemo(
    () => filterRows(rows, filter, deferredSearch),
    [deferredSearch, filter, rows],
  );

  return {
    competition,
    isLoading,
    trackCount: (tracks as TrackSummary[]).length,
    isSignedIn: Boolean(session?.user),
    totalCount: rows.length,
    openCount: rows.filter((row) => isActionable(row.phase)).length,
    enteredCount: rows.filter((row) => row.submissions !== undefined).length,
    nextDeadline,
    sections: sectionRows(visible),
    search,
    setSearch,
    filter,
    setFilter,
  };
}

export type TrackList = ReturnType<typeof useTrackList>;
