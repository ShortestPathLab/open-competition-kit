import { PageSkeleton } from "*/components/skeletons";
import { Button } from "*/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "*/components/ui/empty";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "*/components/panel";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "*/components/ui/item";
import { Separator } from "*/components/ui/separator";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { last, startCase } from "es-toolkit";
import {
  ArrowLeft,
  Inbox,
  Loader2,
  Lock,
  MousePointerClick,
  RotateCcw,
  SearchX,
} from "lucide-react";
import { useEffect, useState } from "react";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { authClient } from "src/lib/auth-client";
import { authMiddleware } from "src/lib/auth-server";
import { resolveId } from "src/lib/configure-user";
import { ensureSubmissionVisible } from "src/lib/route-guards";
import { useSubmissionDetail } from "src/lib/submission-fn";
import { queryClient } from "src/router";
import { z } from "zod";

export const Route = createFileRoute("/me/submissions/$submissionId")({
  // Ownership decides existence here. A submission belonging to another entrant
  // is a 404, not a "forbidden": the second one would tell a stranger that the
  // id they guessed is real.
  // In the loader, so the 404 keeps the "Your competitions" header and tabs
  // above it. A `notFound` from `beforeLoad` carries no route id and would take
  // the whole page.
  loader: ({ params }) => ensureSubmissionVisible(params.submissionId),
  component: SubmissionDetailPage,
});

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

function prettyResult(value: unknown): string {
  if (value === null || value === undefined) return "None";

  if (typeof value === "string") {
    // The string may itself be JSON-encoded (e.g. a stringified object); if so,
    // pretty-print it. Otherwise show the plain string as-is.
    try {
      const parsed = JSON.parse(value);
      if (parsed !== null && typeof parsed === "object") {
        return JSON.stringify(parsed, null, 2);
      }
    } catch {
      // Not JSON, fall through and render the raw string.
    }
    return value;
  }

  // Objects and arrays: render as pretty-printed JSON instead of "[object Object]".
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  // Numbers, booleans, etc.
  return String(value);
}

function statusLabel(status: string) {
  return status.replace(/[-_]/g, " ");
}

function statusTone(status: string) {
  switch (status.toLowerCase()) {
    case "completed":
    case "success":
      return "bg-success/10 text-success";
    case "failed":
    case "error":
      return "bg-destructive/10 text-destructive";
    case "running":
      return "bg-primary/10 text-primary";
    default:
      return "bg-warning/10 text-warning";
  }
}

function SubmissionDetailPage() {
  const { submissionId } = Route.useParams();
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  // No assertion on the session: it is undefined on the first render of every
  // visit, and throwing there took the whole page down before the signed out
  // branch below ever got a chance to render.
  const { data: detail, isLoading } = useSubmissionDetail(
    session?.user?.id,
    submissionId,
  );
  const rerunSubmissionFn = useServerFn(rerunSubmission);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>();

  const selectedJob =
    detail?.jobs.find((job) => job.id === selectedJobId) ?? detail?.jobs[0];

  useEffect(() => {
    if (!detail?.jobs.length) {
      setSelectedJobId(undefined);
      return;
    }

    if (!selectedJobId) {
      setSelectedJobId(last(detail?.jobs)?.id);
    }
  }, [detail?.jobs, selectedJobId]);

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
      <Empty className="rounded-2xl border border-dashed border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Lock />
          </EmptyMedia>
          <EmptyTitle>Sign in to inspect your submissions</EmptyTitle>
          <EmptyDescription>
            Your submissions are only visible when you're signed in.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!detail) {
    return (
      <Empty className="rounded-2xl border border-dashed border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>Submission not found</EmptyTitle>
          <EmptyDescription>
            We couldn't find a submission with this ID.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        render={<Link to="/me/submissions" />}
        className="-ml-2 w-fit"
      >
        <ArrowLeft className="size-4" />
        Back to submissions
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Submission
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight">
            {detail.trackName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {detail.competitionName}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {detail.id}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-5 py-3.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Runs
          </p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
            {detail.jobs.length}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Panel>
          <PanelHeader className="flex-col items-start gap-3">
            <div>
              <PanelTitle>Choose a run</PanelTitle>
              <PanelDescription className="mt-1">
                Select a job on the left to inspect its outputs and logs on the
                right.
              </PanelDescription>
            </div>
            <div className="flex w-full flex-col gap-2">
              <Button
                variant="outline"
                render={
                  <Link
                    to="/competitions/$id/tracks/$trackId"
                    params={{
                      id: detail.competitionId,
                      trackId: detail.trackId,
                    }}
                  />
                }
              >
                Open track
              </Button>
              <Button
                variant="outline"
                render={
                  <Link
                    to="/competitions/$id/submissions/new"
                    params={{ id: detail.competitionId }}
                    search={{ trackId: detail.trackId }}
                  />
                }
              >
                Make another submission
              </Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Re-run
              </Button>
            </div>
          </PanelHeader>
          <PanelBody>
            {detail.jobs.length === 0 ? (
              <Empty className="rounded-xl border border-dashed border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox />
                  </EmptyMedia>
                  <EmptyTitle>No runs yet</EmptyTitle>
                  <EmptyDescription>
                    No jobs exist yet for this submission. Use re-run to create
                    one.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup className="gap-2">
                {detail.jobs
                  .map((job, index) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => setSelectedJobId(job.id)}
                      className="w-full text-left"
                    >
                      <Item
                        variant={
                          selectedJob?.id === job.id ? "muted" : "outline"
                        }
                        className={
                          selectedJob?.id === job.id
                            ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                            : ""
                        }
                      >
                        <ItemContent>
                          <ItemHeader>
                            <div className="min-w-0">
                              <ItemTitle>Run {index + 1}</ItemTitle>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusTone(job.status)}`}
                            >
                              {statusLabel(job.status)}
                            </span>
                          </ItemHeader>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <ItemDescription>
                              {job.outputs.length > 0
                                ? `${job.outputs.length} output record${job.outputs.length === 1 ? "" : "s"}`
                                : "No outputs yet"}
                            </ItemDescription>
                            <p className="font-mono text-[11px] text-muted-foreground">
                              {job.id}
                            </p>
                          </div>
                        </ItemContent>
                      </Item>
                    </button>
                  ))
                  .reverse()}
              </ItemGroup>
            )}
          </PanelBody>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader className="flex-col items-start gap-1">
              <PanelTitle>Submission payload</PanelTitle>
              <PanelDescription>
                The original content that was sent for this submission.
              </PanelDescription>
            </PanelHeader>
            <PanelBody>
              <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-sm break-all whitespace-pre-wrap">
                {detail.body}
              </pre>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader className="flex-col items-start gap-1">
              <div className="flex w-full items-start justify-between gap-3">
                <div>
                  <PanelTitle>
                    {selectedJob ? "Selected run" : "Run details"}
                  </PanelTitle>
                  <PanelDescription className="mt-1">
                    {selectedJob
                      ? "This panel shows the outputs and logs for the run selected on the left."
                      : "Choose a run from the left-hand list to inspect it here."}
                  </PanelDescription>
                </div>
                {selectedJob ? (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusTone(selectedJob.status)}`}
                  >
                    {startCase(statusLabel(selectedJob.status))}
                  </span>
                ) : null}
              </div>
            </PanelHeader>
            <PanelBody className="space-y-4">
              {selectedJob ? (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-sm text-muted-foreground">Run ID</p>
                      <p className="mt-1 font-mono text-xs">{selectedJob.id}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="mt-1 text-sm font-medium capitalize">
                        {statusLabel(selectedJob.status)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-sm text-muted-foreground">Outputs</p>
                      <p className="mt-1 text-sm font-medium">
                        {selectedJob.outputs.length}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Outputs
                    </p>
                    {selectedJob.outputs.length === 0 ? (
                      <Empty className="mt-2 rounded-lg border border-dashed border-border">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Inbox />
                          </EmptyMedia>
                          <EmptyTitle>No outputs yet</EmptyTitle>
                          <EmptyDescription>
                            No outputs have been produced for this job yet.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {selectedJob.outputs.map((output) => (
                          <div
                            key={output.id}
                            className="rounded-lg border border-border p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">
                                {output.reference}
                              </p>
                              <p className="font-mono text-xs text-muted-foreground">
                                {output.id}
                              </p>
                            </div>
                            <pre className="mt-3 overflow-x-auto rounded-md bg-muted/40 p-3 text-sm break-all whitespace-pre-wrap">
                              {prettyResult(output.value)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium text-foreground">Logs</p>
                    <div className="mt-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      {selectedJob.logs}
                    </div>
                  </div>
                </>
              ) : (
                <Empty className="rounded-lg border border-dashed border-border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MousePointerClick />
                    </EmptyMedia>
                    <EmptyTitle>No run selected</EmptyTitle>
                    <EmptyDescription>
                      Select a job from the sidebar to inspect its details.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  );
}
