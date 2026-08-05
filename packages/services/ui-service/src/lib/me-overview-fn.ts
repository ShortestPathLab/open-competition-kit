import { useMemo } from "react";
import { authClient } from "./auth-client";
import { phaseOf } from "./competition-window";
import { useUserEnrolments } from "./enrolment-fn";
import { useGateReports } from "./gate-fn";
import { useUserSubmissions } from "./submission-fn";

/**
 * The reader's own account, summarised.
 *
 * `loading` folds the session in front of the two queries that depend on it: a
 * signed-out reader has nothing to wait for, so the page can go straight to
 * asking them to sign in instead of showing a skeleton that resolves to a
 * prompt.
 */
export function useMeOverview() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { data: enrolments = [], isLoading: enrolmentsLoading } = useUserEnrolments(
    session?.user?.id,
  );
  const { data: submissions = [], isLoading: submissionsLoading } = useUserSubmissions(
    session?.user?.id,
  );
  const { data: reports } = useGateReports(
    enrolments.map((enrolment) => enrolment.track.id),
    session?.user?.id,
  );

  const signedIn = Boolean(session?.user);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      competitions: new Set(enrolments.map((enrolment) => enrolment.competition.id)).size,
      tracks: enrolments.length,
      submissions: submissions.length,
      closing: enrolments.filter(
        (enrolment) => phaseOf(reports?.[enrolment.track.id] ?? [], now) === "closing",
      ).length,
    };
  }, [enrolments, reports, submissions]);

  return {
    signedIn,
    loading: sessionLoading || (signedIn && (enrolmentsLoading || submissionsLoading)),
    enrolments,
    submissions,
    stats,
  };
}

export type MeOverview = ReturnType<typeof useMeOverview>;
