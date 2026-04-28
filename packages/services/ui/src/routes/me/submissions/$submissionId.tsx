import { Button } from "*/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "*/components/ui/card";
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
import { last } from "es-toolkit";
import { ArrowLeft, ArrowRight, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import sdk, { unsafe } from "sdk";
import { authClient } from "src/lib/auth-client";
import { ensureSession } from "src/lib/auth.server";
import { useSubmissionDetail } from "src/lib/submission-fn";
import { queryClient } from "src/router";
import { z } from "zod";

export const Route = createFileRoute("/me/submissions/$submissionId")({
  component: SubmissionDetailPage,
});

const rerunSubmission = createServerFn({ method: "POST" })
  .inputValidator(z.object({ submissionId: z.string() }))
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const submission = await unsafe(sdk.submissions.get(data.submissionId));

    if (submission.user !== session.user.id) {
      throw new Error("Unauthorized");
    }

    return unsafe(
      sdk.jobs.create({
        submission: submission.id,
        status: "pending",
      }),
    );
  });

function prettyResult(result: string) {
  try {
    return JSON.stringify(JSON.parse(result), null, 2);
  } catch {
    return result;
  }
}

function statusLabel(status: string) {
  return status.replace(/[-_]/g, " ");
}

function statusTone(status: string) {
  switch (status.toLowerCase()) {
    case "completed":
    case "success":
      return "bg-emerald-500/10 text-emerald-700";
    case "failed":
    case "error":
      return "bg-red-500/10 text-red-700";
    case "running":
      return "bg-blue-500/10 text-blue-700";
    default:
      return "bg-amber-500/10 text-amber-700";
  }
}

function SubmissionDetailPage() {
  const { submissionId } = Route.useParams();
  const { data: session, isPending: sessionLoading } = authClient.useSession();
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
    onSuccess: async (job: { id: string }) => {
      setSelectedJobId(job.id);
      await queryClient.invalidateQueries({
        queryKey: ["submissionDetail", session?.user?.id, submissionId],
      });
    },
  });

  if (sessionLoading || isLoading) return <div>Loading...</div>;

  if (!session?.user) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            Sign in to inspect your submissions.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!detail) return <div>Submission not found</div>;

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        render={<Link to="/me/submissions" />}
        className="w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to submissions
      </Button>

      <Card className="shadow-sm">
        <CardContent className="px-6 py-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="text-xs font-medium">Submission</div>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold text-foreground">
                  {detail.trackName}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {detail.competitionName}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {detail.id}
                </p>
              </div>
            </div>
            <div className="grid w-full max-w-md gap-3 sm:grid-cols-2 ">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs text-muted-foreground">Runs</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {detail.jobs.length}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="shadow-sm">
          <CardHeader className="border-b border-border">
            <div className="space-y-4">
              <div>
                <CardTitle>Choose a run</CardTitle>
                <CardDescription>
                  Select a job on the left to inspect its outputs and logs on
                  the right.
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2">
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
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Re-run
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="">
            {detail.jobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No jobs exist yet for this submission. Use rerun to create one.
              </div>
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
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="border-b border-border">
              <CardTitle>Submission payload</CardTitle>
              <CardDescription>
                The original content that was sent for this submission.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 ">
              <div>
                <p className="text-sm font-medium text-foreground">Payload</p>
                <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-sm whitespace-pre-wrap break-all">
                  {detail.body}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>
                    {selectedJob ? "Selected run" : "Run details"}
                  </CardTitle>
                  <CardDescription>
                    {selectedJob
                      ? "This panel shows the outputs and logs for the run selected on the left."
                      : "Choose a run from the left-hand list to inspect it here."}
                  </CardDescription>
                </div>
                {selectedJob ? (
                  <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {statusLabel(selectedJob.status)}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>Viewing run details</span>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 ">
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
                      <div className="mt-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                        No outputs have been produced for this job yet.
                      </div>
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
                            <pre className="mt-3 overflow-x-auto rounded-md bg-muted/30 p-3 text-sm whitespace-pre-wrap break-all">
                              {prettyResult(output.result)}
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
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Select a job from the sidebar to inspect its details.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
