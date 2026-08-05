/**
 * Asking every installed gate what it has to say about a set of tracks.
 *
 * The counterpart to `surface-fn`: that one asks packages what to *show* beside
 * a page, this one asks them what is *true* about a track right now. The product
 * draws the answer in its own design, so a package that adds a rule gets a pill,
 * a countdown and a place in the sort order without shipping a line of UI.
 *
 * Nothing here knows what a deadline or a quota is. A report has a state that can
 * be ranked, a label that can be printed and possibly an instant that can be
 * counted down to, and that is enough to build every schedule the product shows.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk, { unsafe, type GateReport } from "@open-competition-kit/sdk";
import { z } from "zod";
import { getAuthSession } from "./auth-server";
import { resolveId } from "./configure-user";

export type ReportsByTrack = Record<string, GateReport[]>;

const gateInput = z.object({ tracks: z.array(z.string()) });

/**
 * Reports for several tracks at once.
 *
 * Batched because the pages that want this want it for a list: a competition's
 * tracks, or every track a competitor has entered. One request and one session
 * lookup for the page, rather than one of each per row.
 *
 * A track that throws contributes nothing rather than failing the batch. These
 * are advisory: the server still refuses a late submission whatever this said,
 * so one broken gate should cost its own pill and not the whole page.
 */
const getGateReports = createServerFn({ method: "GET" })
  .inputValidator(gateInput)
  .handler(async ({ data }): Promise<ReportsByTrack> => {
    const session = await getAuthSession();
    const user = session?.user ? resolveId(session.user) : undefined;

    const entries = await Promise.all(
      data.tracks.map(async (track) => {
        const reports = await unsafe(sdk.submissions.status(track, user)).catch(
          () => [] as GateReport[],
        );
        return [track, reports as GateReport[]] as const;
      }),
    );

    return Object.fromEntries(entries);
  });

/**
 * Reports for a list of tracks, for the reader looking at them.
 *
 * `sessionUserId` never reaches the server, which reads the session itself. It
 * separates one signed-in reader's quota from the next's, so signing out does not
 * leave the previous reader's remaining attempts on screen.
 *
 * Half a minute of staleness. Long enough that moving between pages does not
 * re-ask, short enough that a submission just made is reflected in what is left.
 */
export function useGateReports(tracks: string[], sessionUserId?: string) {
  const fetchReports = useServerFn(getGateReports);
  // Sorted so that two pages asking for the same tracks in a different order
  // share one cache entry rather than each paying for its own.
  const key = [...tracks].sort();

  return useQuery({
    queryKey: ["gate-reports", key, sessionUserId],
    queryFn: () => fetchReports({ data: { tracks: key } }),
    enabled: key.length > 0,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });
}

/** Reports for one track, expressed through the batch so the cache is shared. */
export function useTrackReports(track: string | undefined, sessionUserId?: string) {
  const query = useGateReports(track ? [track] : [], sessionUserId);
  return {
    ...query,
    reports: track ? (query.data?.[track] ?? []) : [],
  };
}

/**
 * A list of tracks, each carrying what its gates reported.
 *
 * The shape every schedule, sort and section in the product works from. Reports
 * default to an empty list while the query is in flight, which reads as a track
 * with no rules: the pill says open, no dates appear, and the panel that would
 * show them stays hidden until there is something to put in it.
 */
export function useTracksWithReports<T extends { id: string; name: string }>(
  tracks: readonly T[],
  sessionUserId?: string,
): (T & { reports: GateReport[] })[] {
  const ids = tracks.map((track) => track.id);
  const { data } = useGateReports(ids, sessionUserId);

  return useMemo(
    () => tracks.map((track) => ({ ...track, reports: data?.[track.id] ?? [] })),
    [tracks, data],
  );
}
