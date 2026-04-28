import { Button } from "*/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "*/components/ui/card";
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
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";
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
      setSelectedJobId(detail.jobs[0]?.id);
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

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="shadow-sm">
          <CardHeader className="border-b border-border">
            <div className="space-y-3">
              <div>
                <CardTitle>{detail.trackName}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {detail.competitionName}
                </p>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="font-mono text-xs">{detail.id}</p>
              </div>
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <RotateCcw className="h-4 w-4" />
                Rerun submission
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-foreground">Jobs</h3>
              <p className="text-sm text-muted-foreground">
                Select a job to inspect its status and outputs.
              </p>
            </div>
            {detail.jobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No jobs exist yet for this submission. Use rerun to create one.
              </div>
            ) : (
              <ItemGroup className="gap-2">
                {detail.jobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setSelectedJobId(job.id)}
                    className="w-full text-left"
                  >
                    <Item
                      variant={selectedJob?.id === job.id ? "muted" : "outline"}
                    >
                      <ItemContent>
                        <ItemHeader>
                          <ItemTitle>{job.status}</ItemTitle>
                          <p className="font-mono text-xs text-muted-foreground">
                            {job.id}
                          </p>
                        </ItemHeader>
                        <ItemDescription>
                          {job.outputs.length > 0
                            ? `${job.outputs.length} output record${job.outputs.length === 1 ? "" : "s"}`
                            : "No outputs yet"}
                        </ItemDescription>
                      </ItemContent>
                    </Item>
                  </button>
                ))}
              </ItemGroup>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="border-b border-border">
              <CardTitle>Submission details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
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
              <CardTitle>Job details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {selectedJob ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-sm text-muted-foreground">Job ID</p>
                      <p className="mt-1 font-mono text-xs">{selectedJob.id}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="mt-1 text-sm font-medium capitalize">
                        {selectedJob.status}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium text-foreground">Outputs</p>
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
