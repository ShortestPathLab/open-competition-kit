import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { surface } from "@open-competition-kit/sdk/surface";
import { Inbox, Loader2, RotateCcw, SearchX, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminPageHeader, type AdminParent } from "@/components/admin-page-header";
import { formatWhen, QueryFailure } from "@/components/dashboard/parts";
import { JobStatusBadge } from "@/components/job-status-badge";
import { HeaderStats, PageBody } from "@/components/page-header-band";
import { PageSkeleton } from "@/components/skeletons";
import { Stat } from "@/components/stat-strip";
import { CopyId, ResultStat, RunCard } from "@/components/submission-detail/parts";
import {
  LogsPanel,
  OtherOutputsPanel,
  ResultPanel,
} from "@/components/submission-detail/result-panel";
import { SubmittedPanel } from "@/components/submission-detail/submitted-panel";
import { SurfaceSlot } from "@/components/surface-slot";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { rerunAdminSubmission, useAdminSubmission } from "@/lib/dashboard-fn";
import { readBody, readResult } from "@/lib/submission-readout";
import type { SubmissionJob } from "@/lib/submission-fn";
import { queryClient } from "@/router";

export const Route = createFileRoute("/dashboard/$competitionId/submissions/$submissionId")({
  component: AdminSubmissionDetailPage,
});

const BACK: AdminParent = { label: "Submissions", section: "submissions" };

/**
 * One submission, as the organiser who has to answer for it reads it.
 *
 * The same panels the entrant sees on their own copy, which is deliberate: a
 * support thread about a failed run goes better when both people are looking at
 * the same result, the same logs and the same body. What differs is the frame
 * around them. The header names whose submission this is and links to the rest
 * of their history, and the rerun button is here because the reason to use it is
 * usually the organiser's: a runner that was misconfigured, or a batch of jobs
 * that died on a machine since fixed.
 */
function AdminSubmissionDetailPage() {
  const { competitionId, submissionId } = Route.useParams();
  const {
    data: detail,
    isLoading,
    isError,
    error,
  } = useAdminSubmission(competitionId, submissionId);
  const rerun = useServerFn(rerunAdminSubmission);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>();

  // Memoised so the effect below keys off the jobs actually changing. A bare
  // `?? []` hands back a fresh array on every render.
  const jobs = useMemo(() => detail?.jobs ?? [], [detail?.jobs]);
  const selectedIndex = Math.max(
    jobs.findIndex((job) => job.id === selectedJobId),
    0,
  );
  const selectedJob: SubmissionJob | undefined = jobs[selectedIndex];

  useEffect(() => {
    if (!jobs.length) {
      setSelectedJobId(undefined);
      return;
    }
    // The newest run answers "what happened", so the page opens on it until
    // somebody picks another.
    if (!selectedJobId || !jobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(jobs.at(-1)?.id);
    }
  }, [jobs, selectedJobId]);

  const mutation = useMutation({
    mutationFn: () => rerun({ data: { competitionId, submissionId } }),
    onSuccess: async (result: { jobs: string[] }) => {
      setSelectedJobId(result.jobs.at(-1));
      await queryClient.invalidateQueries({
        queryKey: ["dashboardSubmission", competitionId, submissionId],
      });
      // The list behind this page counts runs, so it is wrong the moment a new
      // one is created.
      await queryClient.invalidateQueries({ queryKey: ["competitionActivity", competitionId] });
    },
  });

  if (isLoading) return <PageSkeleton />;

  if (isError || !detail) {
    return (
      <>
        <AdminPageHeader competitionId={competitionId} title="Submission" back={BACK} />
        <PageBody>
          {/* Told apart, because this page polls: a run that is still going
              refetches every two seconds, and one failed refetch reporting the
              submission as gone would be alarming and wrong. */}
          {isError ? (
            <QueryFailure error={error} />
          ) : (
            <Empty className="rounded-2xl border border-dashed border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchX />
                </EmptyMedia>
                <EmptyTitle>Submission not found</EmptyTitle>
                <EmptyDescription>
                  Nothing in this competition has the id{" "}
                  <code className="font-mono">{submissionId}</code>.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </PageBody>
      </>
    );
  }

  const readout = readResult(selectedJob?.result ?? null);
  const body = readBody(detail.body);

  return (
    <>
      <AdminPageHeader
        competitionId={competitionId}
        competitionName={detail.competitionName}
        back={BACK}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {detail.userName}
            {jobs.length > 0 ? <JobStatusBadge status={jobs.at(-1)?.status} /> : null}
          </span>
        }
        description={
          <>
            <span className="block text-foreground">
              Submission {detail.number} to {detail.trackName}
              {detail.submittedAt ? `, ${formatWhen(detail.submittedAt)} UTC` : ""}
            </span>
            <CopyId value={detail.id} />
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="lg"
              className="h-10 px-5"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              Run again
            </Button>
            <Button
              size="lg"
              className="h-10 px-5"
              render={
                <Link
                  to="/dashboard/$competitionId/participants/$user"
                  params={{ competitionId, user: detail.user }}
                />
              }
            >
              <User />
              This competitor
            </Button>
          </>
        }
        meta={
          <HeaderStats>
            <ResultStat
              job={selectedJob}
              readout={readout}
              runNumber={selectedIndex + 1}
              runCount={jobs.length}
            />
            <Stat label="Runs" value={jobs.length} />
            <Stat label="Attempt" value={detail.number} />
            <Stat
              label="Track"
              value={<span className="font-sans text-base">{detail.trackName}</span>}
            />
          </HeaderStats>
        }
      />

      <PageBody className="space-y-6">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Evaluation history
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Every run scores this same submission. Pick one to read its result and logs.
          </p>
        </div>

        {jobs.length === 0 ? (
          <Empty className="rounded-xl border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>No runs yet</EmptyTitle>
              <EmptyDescription>
                Nothing has evaluated this submission. Use run again to create a job for it, or
                check that a runner package is installed and configured.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div
            role="group"
            aria-label="Runs for this submission"
            className="flex gap-2.5 overflow-x-auto pb-1"
          >
            {jobs.map((job, index) => (
              <RunCard
                key={job.id}
                job={job}
                index={index}
                selected={job.id === selectedJob?.id}
                onSelect={() => setSelectedJobId(job.id)}
              />
            ))}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <ResultPanel job={selectedJob} readout={readout} runNumber={selectedIndex + 1} />
            <LogsPanel job={selectedJob} />

            {/* Keyed by the run, so a package that keeps something per attempt
                points at this one rather than at the submission behind all of
                them. */}
            {selectedJob ? (
              <>
                <SurfaceSlot
                  surface={surface.std.jobDetail}
                  subject={{ job: selectedJob.id }}
                  layout="inline"
                />
                <OtherOutputsPanel job={selectedJob} />
              </>
            ) : null}
          </div>

          <div className="space-y-4">
            <SubmittedPanel body={body} raw={detail.body} />
            <SurfaceSlot
              surface={surface.std.submissionDetail}
              subject={{ submission: detail.id }}
            />
          </div>
        </div>
      </PageBody>
    </>
  );
}
