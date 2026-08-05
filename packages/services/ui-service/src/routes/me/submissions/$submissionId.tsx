import { MePageHeader, type MeCrumb } from "@/components/me-page-header";
import { PageBody } from "@/components/page-header-band";
import { PageSkeleton } from "@/components/skeletons";
import { SubmissionHeader } from "@/components/submission-detail/header";
import { RunCard } from "@/components/submission-detail/parts";
import {
  LogsPanel,
  OtherOutputsPanel,
  ResultPanel,
} from "@/components/submission-detail/result-panel";
import { SubmittedPanel, TrackLinksPanel } from "@/components/submission-detail/submitted-panel";
import { SurfaceSlot } from "@/components/surface-slot";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { Inbox, Lock, SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { surface } from "@open-competition-kit/sdk/surface";
import { authClient } from "@/lib/auth-client";
import { authMiddleware } from "@/lib/auth-server";
import { resolveId } from "@/lib/configure-user";
import { ensureSubmissionVisible } from "@/lib/route-guards";
import { useSubmissionDetail, type SubmissionJob } from "@/lib/submission-fn";
import { readBody, readResult } from "@/lib/submission-readout";
import { queryClient } from "@/router";
import { z } from "zod";

export const Route = createFileRoute("/me/submissions/$submissionId")({
  // Ownership decides existence here. A submission belonging to another entrant is
  // a 404, not a "forbidden": the second would tell a stranger that the id they
  // guessed is real. In the loader rather than `beforeLoad` so the 404 keeps this
  // route's id and renders inside the personal area.
  loader: ({ params }) => ensureSubmissionVisible(params.submissionId),
  component: SubmissionDetailPage,
});

/** Where this page sits: below the submissions list, which is a section. */
const SUBMISSIONS_TRAIL: MeCrumb[] = [{ label: "Submissions", section: "submissions" }];

const rerunSubmission = createServerFn({ method: "POST" })
  .inputValidator(z.object({ submissionId: z.string() }))
  .middleware([authMiddleware])
  .handler(async ({ data, context: { session } }) => {
    const submission = await unsafe(sdk.submissions.get(data.submissionId));

    if (submission.user !== resolveId(session.user)) {
      throw new Error("Unauthorized");
    }

    return unsafe(sdk.jobs.createFromSubmission(submission.id));
  });

/** A full-page message with an icon, for the states that have no submission. */
function DetailNotice({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <MePageHeader title="Submission" crumb="Submission" trail={SUBMISSIONS_TRAIL} />
      <PageBody>
        <Empty className="rounded-2xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">{icon}</EmptyMedia>
            <EmptyTitle>{title}</EmptyTitle>
            <EmptyDescription>{children}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </PageBody>
    </>
  );
}

function SubmissionDetailPage() {
  const { submissionId } = Route.useParams();
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  // No assertion on the session: it is undefined on the first render of every
  // visit, and throwing there took the whole page down before the signed-out
  // branch below ever got a chance to render.
  const { data: detail, isLoading } = useSubmissionDetail(session?.user?.id, submissionId);
  const rerunSubmissionFn = useServerFn(rerunSubmission);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>();

  // Memoised so the effect below keys off the jobs actually changing. A bare
  // `?? []` hands back a fresh array every render, which re-ran the effect on
  // every render.
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
    mutationFn: () => (rerunSubmissionFn as any)({ data: { submissionId } }),
    onSuccess: async (result: { jobs: string[] }) => {
      setSelectedJobId(result.jobs.at(-1));
      await queryClient.invalidateQueries({
        queryKey: ["submissionDetail", session?.user?.id, submissionId],
      });
    },
  });

  if (sessionLoading || isLoading) return <PageSkeleton />;

  if (!session?.user) {
    return (
      <DetailNotice icon={<Lock />} title="Sign in to inspect your submissions">
        Your submissions are only visible when you're signed in.
      </DetailNotice>
    );
  }

  if (!detail) {
    return (
      <DetailNotice icon={<SearchX />} title="Submission not found">
        {/* The one place the id belongs: somebody following a link that does not
            work needs to see what was looked up. */}
        Nothing here belongs to you under <code className="font-mono">{submissionId}</code>.
      </DetailNotice>
    );
  }

  const readout = readResult(selectedJob?.result ?? null);
  const body = readBody(detail.body);

  return (
    <>
      <SubmissionHeader
        detail={detail}
        trail={SUBMISSIONS_TRAIL}
        jobs={jobs}
        selectedJob={selectedJob}
        selectedIndex={selectedIndex}
        readout={readout}
        onRerun={() => mutation.mutate()}
        rerunning={mutation.isPending}
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
                No jobs exist yet for this submission. Use run again to create one.
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

            {/* Keyed by the run, so a package that keeps something per attempt (a
                workflow, an artefact, a log elsewhere) points at this one rather
                than at the submission behind all of them. */}
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

            {/* Under what they submitted, because that is what this is about:
                where the contents actually came from, which the body alone cannot
                say once a form field holds a ref or a file reference. */}
            <SurfaceSlot
              surface={surface.std.submissionDetail}
              subject={{ submission: detail.id }}
            />

            <TrackLinksPanel competitionId={detail.competitionId} trackId={detail.trackId} />
          </div>
        </div>
      </PageBody>
    </>
  );
}
