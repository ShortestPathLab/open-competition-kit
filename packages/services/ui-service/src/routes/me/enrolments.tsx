import {
  EnrolmentBrowser,
  type EnrolmentResult,
} from "*/components/enrolment-browser";
import { MePageHeader } from "*/components/me-page-header";
import { HeaderStats, PageBody } from "*/components/page-header-band";
import { Stat } from "*/components/stat-strip";
import { phaseOf } from "*/components/submission-window";
import { Button } from "*/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { authClient } from "src/lib/auth-client";
import { useUserEnrolments } from "src/lib/enrolment-fn";
import { useGateReports } from "src/lib/gate-fn";
import {
  useUserSubmissionOutcomes,
  type SubmissionOutcome,
} from "src/lib/submission-fn";
import { readResult } from "src/lib/submission-readout";

export const Route = createFileRoute("/me/enrolments")({
  component: MeEnrolmentsPage,
});

/**
 * The newest result for a track, which is a fact, rather than the best one,
 * which is not.
 *
 * Nothing on a submission says whether a higher score is better. Only the
 * leaderboard's `from.rank` knows, and it is not read here, so calling the
 * largest number "best" would be guessing at a direction the organiser never
 * stated.
 */
function latestResult(
  submissionIds: string[],
  outcomes: Record<string, SubmissionOutcome> | undefined,
): EnrolmentResult | undefined {
  if (!outcomes) return undefined;

  for (const id of [...submissionIds].reverse()) {
    const headline = readResult(outcomes[id]?.result).headline;
    if (headline) {
      return {
        label: `Latest ${headline.label.toLowerCase()}`,
        value: headline.value,
      };
    }
  }

  return undefined;
}

function MeEnrolmentsPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { data: enrolments = [], isLoading } = useUserEnrolments(
    session?.user?.id,
  );
  // A second query rather than a heavier first one: the list paints from the
  // enrolments, and the result column fills in when this lands.
  const { data: outcomes } = useUserSubmissionOutcomes(session?.user?.id);
  // Asked once for every track on the page, and shared with the browser below so
  // the rows and the header stats agree about what is open.
  const { data: reports } = useGateReports(
    enrolments.map((enrolment) => enrolment.track.id),
    session?.user?.id,
  );

  const stats = useMemo(() => {
    const now = Date.now();
    const phases = enrolments.map((enrolment) =>
      phaseOf(reports?.[enrolment.track.id] ?? [], now),
    );

    return {
      tracks: enrolments.length,
      open: phases.filter((phase) => phase === "open" || phase === "closing")
        .length,
      closing: phases.filter((phase) => phase === "closing").length,
      submissions: enrolments.reduce(
        (total, enrolment) => total + enrolment.submissions.length,
        0,
      ),
    };
  }, [enrolments, reports]);

  const results = useMemo(() => {
    const byTrack: Record<string, EnrolmentResult | undefined> = {};
    for (const enrolment of enrolments) {
      byTrack[enrolment.track.id] = latestResult(
        enrolment.submissions.map((submission) => submission.id),
        outcomes,
      );
    }
    return byTrack;
  }, [enrolments, outcomes]);

  return (
    <>
      <MePageHeader
        title="Enrolments"
        description="Tracks you are participating in, grouped by the competition they belong to."
        actions={
          <Button
            size="lg"
            className="h-10 px-5"
            render={<Link to="/competitions" />}
          >
            Browse competitions
            <ArrowRight />
          </Button>
        }
        meta={
          session?.user && enrolments.length > 0 ?
            <HeaderStats>
              <Stat label="Enrolled tracks" value={stats.tracks} />
              <Stat label="Open now" value={stats.open} />
              <Stat
                label="Closing soon"
                value={stats.closing}
                emphasis={stats.closing > 0}
              />
              <Stat label="Submissions" value={stats.submissions} />
              {/* TODO(standings): the mockup also shows a best rank here. It
                  needs a per-user read across every leaderboard the reader
                  appears on, which no server function does yet. */}
            </HeaderStats>
          : undefined
        }
        tabs
      />
      <PageBody>
        <EnrolmentBrowser
          enrolments={enrolments}
          isSessionLoading={sessionLoading}
          isSignedIn={Boolean(session?.user)}
          isLoading={isLoading}
          results={results}
          reports={reports}
        />
      </PageBody>
    </>
  );
}
