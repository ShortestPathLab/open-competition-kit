import { MePageHeader } from "@/components/me-page-header";
import { HeaderStats, PageBody } from "@/components/page-header-band";
import { Stat } from "@/components/stat-strip";
import { SubmissionBrowser } from "@/components/submission-browser";
import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { authClient } from "@/lib/auth-client";
import {
  useUserSubmissionOutcomes,
  useUserSubmissions,
} from "@/lib/submission-fn";
import { describeJobStatus } from "@/lib/submission-readout";

export const Route = createFileRoute("/me/submissions/")({
  component: MeSubmissionsPage,
});

function MeSubmissionsPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { data: submissions = [], isLoading: submissionsLoading } =
    useUserSubmissions(session?.user?.id);
  // What each one produced, asked for separately so the list is not held up by
  // a job read per submission.
  const { data: outcomes, isLoading: outcomesLoading } =
    useUserSubmissionOutcomes(session?.user?.id);

  const stats = useMemo(() => {
    const tones = submissions.map(
      (submission) => describeJobStatus(outcomes?.[submission.id]?.status).tone,
    );

    return {
      total: submissions.length,
      tracks: new Set(submissions.map((submission) => submission.trackId)).size,
      scored: tones.filter((tone) => tone === "success").length,
      failed: tones.filter((tone) => tone === "destructive").length,
    };
  }, [outcomes, submissions]);

  return (
    <>
      <MePageHeader
        title="Submissions"
        description="Every submission you have made across competitions and tracks, newest first."
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
          session?.user && submissions.length > 0 ?
            <HeaderStats>
              <Stat label="Submissions" value={stats.total} />
              <Stat label="Tracks" value={stats.tracks} />
              {/* Both counts wait on the outcomes query, so they stay out of the
                  strip until it has answered rather than reading as zero. */}
              {outcomes ?
                <>
                  <Stat label="Scored" value={stats.scored} />
                  <Stat
                    label="Failed"
                    value={stats.failed}
                    emphasis={stats.failed > 0}
                  />
                </>
              : null}
            </HeaderStats>
          : undefined
        }
        tabs
      />
      <PageBody>
        <SubmissionBrowser
          submissions={submissions}
          isSessionLoading={sessionLoading}
          isSignedIn={Boolean(session?.user)}
          isLoading={submissionsLoading}
          outcomes={outcomes}
          outcomesLoading={outcomesLoading}
        />
      </PageBody>
    </>
  );
}
