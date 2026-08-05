import { skipToken, useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { countTrackEnrolments, countTrackSubmissions, getTrackSummary } from "./competition-data";
import { z } from "zod";

const trackInput = z.object({ trackId: z.string() });

const getTrack = createServerFn({ method: "GET" })
  .inputValidator(trackInput)
  .handler(({ data }) => getTrackSummary(data.trackId));

const getTrackSubmissionCount = createServerFn({ method: "GET" })
  .inputValidator(trackInput)
  .handler(({ data }) => countTrackSubmissions(data.trackId));

const getTrackEnrolmentCount = createServerFn({ method: "GET" })
  .inputValidator(trackInput)
  .handler(({ data }) => countTrackEnrolments(data.trackId));

export function useTrack(trackId?: string) {
  const fetchTrack = useServerFn(getTrack);
  return useQuery({
    queryKey: ["track", trackId],
    queryFn: trackId ? () => fetchTrack({ data: { trackId } }) : skipToken,
  });
}

/**
 * The track's total submission count, not the reader's own.
 *
 * Split from `useTrack` for the reason the competition counts are split from
 * `useCompetition`: the number moves every time somebody submits, while the rest
 * of the summary comes from config and sits still, so one cache entry would mean
 * either a stale count or refetching the name and rules to update an integer.
 */
export function useTrackSubmissionCount(trackId?: string) {
  const getCount = useServerFn(getTrackSubmissionCount);
  return useQuery({
    queryKey: ["track-submission-count", trackId],
    queryFn: trackId ? () => getCount({ data: { trackId } }) : skipToken,
  });
}

/** How many entrants the track holds, for the same reasons as above. */
export function useTrackEnrolmentCount(trackId?: string) {
  const getCount = useServerFn(getTrackEnrolmentCount);
  return useQuery({
    queryKey: ["track-enrolment-count", trackId],
    queryFn: trackId ? () => getCount({ data: { trackId } }) : skipToken,
  });
}
