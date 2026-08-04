import { skipToken, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { authClient } from "./auth-client";
import { useCompetition } from "./competition-fn";
import { getEnrollmentStatus } from "./enrolment-fn";
import { useTrackReports } from "./gate-fn";
import {
  useTrack,
  useTrackEnrolmentCount,
  useTrackSubmissionCount,
} from "./track-fn";

/**
 * One track, the competition it belongs to, and where the reader stands in it.
 *
 * Every query here runs unconditionally so the page can keep its early returns:
 * hooks cannot run conditionally, and `track` is absent on the first render.
 */
export function useTrackDetail(competitionId: string, trackId: string) {
  const { data: session } = authClient.useSession();
  const { data: competition } = useCompetition(competitionId);
  const fetchEnrollmentStatus = useServerFn(getEnrollmentStatus);

  const { data: track, isLoading: trackLoading } = useTrack(trackId);
  const { data: submissionCount } = useTrackSubmissionCount(trackId);
  const { data: enrolmentCount } = useTrackEnrolmentCount(trackId);

  const { data: isEnrolled = false, isLoading: enrollmentLoading } = useQuery({
    queryKey: ["enrollmentStatus", session?.user?.id, trackId],
    queryFn:
      session?.user?.id
        ? () => fetchEnrollmentStatus({ data: { trackId } })
        : skipToken,
  });

  const { reports } = useTrackReports(trackId, session?.user?.id);

  return {
    competition,
    track,
    trackLoading,
    submissionCount,
    enrolmentCount,
    isEnrolled,
    enrollmentLoading,
    isSignedIn: Boolean(session?.user),
    reports,
  };
}

export type TrackDetail = ReturnType<typeof useTrackDetail>;
