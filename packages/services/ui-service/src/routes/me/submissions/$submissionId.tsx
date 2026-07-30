import { JobStatusBadge } from "*/components/job-status-badge";
import {
  MePageHeader,
  type MeCrumb,
} from "*/components/me-page-header";
import { HeaderStats, PageBody } from "*/components/page-header-band";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "*/components/panel";
import { PageSkeleton } from "*/components/skeletons";
import { Stat } from "*/components/stat-strip";
import { SurfaceSlot } from "*/components/surface-slot";
import { ValueTree } from "*/components/value-tree";
import { Button } from "*/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "*/components/ui/empty";
import { cn } from "*/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Download,
  Inbox,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  SearchX,
} from "lucide-react";
import { useEffect, useState } from "react";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { surface } from "@open-competition-kit/sdk/surface";
import { authClient } from "src/lib/auth-client";
import { authMiddleware } from "src/lib/auth-server";
import { resolveId } from "src/lib/configure-user";
import { ensureSubmissionVisible } from "src/lib/route-guards";
import { useSubmissionDetail, type SubmissionJob } from "src/lib/submission-fn";
import {
  describeJobStatus,
  formatBytes,
  formatResultValue,
  formatScore,
  prettyJson,
  readBody,
  readResult,
  type ResultReadout,
} from "src/lib/submission-readout";
import { queryClient } from "src/router";
import { z } from "zod";

export const Route = createFileRoute("/me/submissions/$submissionId")({
  // Ownership decides existence here. A submission belonging to another entrant
  // is a 404, not a "forbidden": the second one would tell a stranger that the
  // id they guessed is real.
  // In the loader rather than `beforeLoad` so the 404 keeps this route's id and
  // renders inside the personal area, the same way a missing track renders
  // inside its competition.
  loader: ({ params }) => ensureSubmissionVisible(params.submissionId),
  component: SubmissionDetailPage,
});

/** Where this page sits: below the submissions list, which is a section. */
const SUBMISSIONS_TRAIL: MeCrumb[] = [
  { label: "Submissions", section: "submissions" },
];

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

/** The id, and a way to take it somewhere else. */
function CopyId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="mt-3 inline-flex items-center gap-1 rounded-lg border border-border bg-muted py-1 pr-1 pl-3 font-mono text-xs text-muted-foreground">
      {value}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 gap-1.5 px-2 font-sans text-xs"
        onClick={() =>
          navigator.clipboard?.writeText(value).then(
            () => setCopied(true),
            () => undefined,
          )
        }
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

/**
 * What the submission scored, as the first cell of the header strip.
 *
 * A failed run has no number to show, so the cell names the run that failed and
 * leaves the reason to the logs panel rather than printing a zero nobody
 * earned. The tone is what the old verdict card carried: the score is the one
 * number on this page that is good or bad news.
 */
function ResultStat({
  job,
  readout,
  runNumber,
  runCount,
}: {
  job?: SubmissionJob;
  readout: ResultReadout;
  runNumber: number;
  runCount: number;
}) {
  if (!job) {
    return <Stat label="Result" value="Not scored yet" />;
  }

  const failed = describeJobStatus(job.status).tone === "destructive";

  return (
    <Stat
      tone={
        failed ? "destructive"
        : readout.headline ? "success"
        : undefined
      }
      label={
        failed ? `Run ${runNumber} of ${runCount} failed`
        : (readout.headline?.label ?? "Result")
      }
      value={
        readout.headline ?
          formatScore(readout.headline.value)
        : <span className="font-sans text-base">
            {readout.present ? "No headline score" : "Not scored yet"}
          </span>
      }
    />
  );
}

/** One run in the strip: which attempt it was, and how it went. */
function RunCard({
  job,
  index,
  selected,
  onSelect,
}: {
  job: SubmissionJob;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const readout = readResult(job.result);
  const { tone } = describeJobStatus(job.status);

  const outcome =
    readout.headline ?
      `${readout.headline.label.toLowerCase()} ${formatScore(readout.headline.value)}`
    : tone === "destructive" ? "no result written"
    : tone === "pending" ? "waiting on the runner"
    : `${job.outputs.length} output${job.outputs.length === 1 ? "" : "s"}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-44 shrink-0 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected ?
          "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
        : "border-border bg-card hover:border-input",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-sm font-semibold", selected && "text-primary")}>
          Run {index + 1}
        </span>
        <JobStatusBadge status={job.status} />
      </div>
      {/* No job id. "Run 2" is what somebody calls this when they ask about it,
          and the strip is already ordered, so the cuid was only ever noise. */}
      <p className="mt-1.5 truncate font-mono text-xs text-muted-foreground">
        {outcome}
      </p>
    </button>
  );
}

/** The runner's log lines. Dark in both themes, the way a console reads. */
function LogConsole({ lines }: { lines: string[] }) {
  return (
    <div className="max-h-72 overflow-auto bg-terminal py-3 font-mono text-xs leading-relaxed text-terminal-foreground">
      {lines.map((line, index) => (
        <div
          key={index}
          className={cn(
            "grid grid-cols-[2.5rem_1fr] gap-3 px-4",
            /error|exception|traceback/i.test(line) && "bg-destructive/20",
          )}
        >
          <span className="text-terminal-foreground/35 select-none text-right">
            {index + 1}
          </span>
          <span className="wrap-break-word whitespace-pre-wrap">{line}</span>
        </div>
      ))}
    </div>
  );
}

/** A JSON value, kept out of the way until somebody asks for it. */
function RawDisclosure({ label, value }: { label: string; value: unknown }) {
  return (
    <details className="group border-t border-border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
        {label}
      </summary>
      <pre className="overflow-x-auto px-5 pb-4 font-mono text-xs text-muted-foreground">
        {prettyJson(value)}
      </pre>
    </details>
  );
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

  const jobs = detail?.jobs ?? [];
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
    // The newest run is the one that answers "what happened", so the page opens
    // on it until somebody picks another.
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
      <>
        <MePageHeader
          title="Submission"
          crumb="Submission"
          trail={SUBMISSIONS_TRAIL}
        />
        <PageBody>
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
        </PageBody>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <MePageHeader
          title="Submission"
          crumb="Submission"
          trail={SUBMISSIONS_TRAIL}
        />
        <PageBody>
          <Empty className="rounded-2xl border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>Submission not found</EmptyTitle>
              {/* The one place the id belongs: somebody following a link that
                  does not work needs to see what was looked up. */}
              <EmptyDescription>
                Nothing here belongs to you under{" "}
                <code className="font-mono">{submissionId}</code>.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </PageBody>
      </>
    );
  }

  const readout = readResult(selectedJob?.result ?? null);
  const body = readBody(detail.body);
  const runtime = readout.meta.find((entry) =>
    ["runtime", "duration", "elapsed"].includes(entry.key.toLowerCase()),
  );
  const warnings = readout.meta.find((entry) =>
    ["warning", "warnings"].includes(entry.key.toLowerCase()),
  );

  return (
    <>
      <MePageHeader
        trail={SUBMISSIONS_TRAIL}
        crumb={`Submission ${detail.number}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {detail.trackName}
            {jobs.length > 0 ?
              <JobStatusBadge status={jobs.at(-1)?.status} />
            : null}
          </span>
        }
        description={
          <>
            <span className="block text-foreground">
              {detail.competitionName}
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
              {mutation.isPending ?
                <Loader2 className="animate-spin" />
              : <RotateCcw />}
              Run again
            </Button>
            <Button
              size="lg"
              className="h-10 px-5"
              render={
                <Link
                  to="/competitions/$id/submissions/new"
                  params={{ id: detail.competitionId }}
                  search={{ trackId: detail.trackId }}
                />
              }
            >
              <Plus />
              New submission
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
            <Stat
              label="Last run"
              value={
                <span className="font-sans text-base">
                  {describeJobStatus(jobs.at(-1)?.status).label}
                </span>
              }
            />
            {runtime ?
              <Stat
                label={runtime.label}
                value={formatResultValue(runtime.value)}
              />
            : null}
            {warnings ?
              <Stat
                label={warnings.label}
                value={formatResultValue(warnings.value)}
              />
            : null}
          </HeaderStats>
        }
      />

      <PageBody className="space-y-6">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Evaluation history
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Every run scores this same submission. Pick one to read its result
            and logs.
          </p>
        </div>

        {jobs.length === 0 ?
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
      : <div
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
      }

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader>
              <PanelTitle>
                {selectedJob ? `Result from run ${selectedIndex + 1}` : "Result"}
              </PanelTitle>
              <span className="font-mono text-xs text-muted-foreground">
                tag/output/default
              </span>
            </PanelHeader>
            {!selectedJob || !readout.present ?
              <PanelBody className="py-8 text-center">
                <p className="text-sm font-medium">
                  {selectedJob ?
                    "This run produced no result"
                  : "No run selected"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedJob ?
                    "It stopped before the suite wrote an output. The logs below have the reason."
                  : "Pick a run above to read what it produced."}
                </p>
              </PanelBody>
            : <>
                {readout.meta.length > 0 ?
                  <div className="flex flex-wrap gap-2 px-5 pt-4">
                    {readout.meta.map((entry) => (
                      <span
                        key={entry.key}
                        className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        {entry.label}{" "}
                        <b className="font-mono font-semibold text-foreground">
                          {formatResultValue(entry.value)}
                        </b>
                      </span>
                    ))}
                  </div>
                : null}

                <PanelBody className="p-2">
                  {readout.scores.map((score) => (
                    <div
                      key={score.key}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2.5 last:border-b-0"
                    >
                      <span className="text-sm">{score.label}</span>
                      <span className="font-mono text-sm font-semibold tabular-nums">
                        {formatScore(score.value)}
                      </span>
                      {/* A bar only where one is honest: a score outside 0 to 1
                          has no stated ceiling to draw against. */}
                      {score.value >= 0 && score.value <= 1 ?
                        <span className="col-span-2 h-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full bg-primary/60"
                            style={{ width: `${score.value * 100}%` }}
                          />
                        </span>
                      : null}
                    </div>
                  ))}
                  {readout.headline ?
                    <div className="mt-1 flex items-center justify-between gap-4 rounded-lg bg-muted px-3 py-2.5">
                      <span className="text-sm font-semibold">
                        {readout.headline.label}
                      </span>
                      <span className="font-mono text-lg font-semibold text-primary tabular-nums">
                        {formatScore(readout.headline.value)}
                      </span>
                    </div>
                  : null}
                  {readout.nested.map((entry) => (
                    <div key={entry.key} className="px-3 py-2.5">
                      <p className="text-sm font-medium">{entry.label}</p>
                      <ValueTree className="mt-2" value={entry.value} />
                    </div>
                  ))}
                </PanelBody>
                <RawDisclosure
                  label="Raw output value"
                  value={selectedJob.result}
                />
              </>
            }
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Logs</PanelTitle>
              <span className="font-mono text-xs text-muted-foreground">
                {selectedJob?.logs.length ?
                  `${selectedJob.logs.length} lines`
                : "tag/logs"}
              </span>
            </PanelHeader>
            {selectedJob?.logs.length ?
              <LogConsole lines={selectedJob.logs} />
            : <PanelBody className="py-8 text-center">
                <p className="text-sm font-medium">No logs for this run</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The runner for this track does not write log lines yet.
                </p>
              </PanelBody>
            }
          </Panel>

          {/* Keyed by the run, so a package that keeps something per attempt (a
              workflow, an artefact, a log elsewhere) points at this one rather
              than at the submission behind all of them. */}
          {selectedJob ?
            <SurfaceSlot
              surface={surface.std.jobDetail}
              subject={{ job: selectedJob.id }}
              layout="inline"
            />
          : null}

          {selectedJob && selectedJob.outputs.length > 0 ?
            <Panel>
              <PanelHeader>
                <PanelTitle>Other outputs</PanelTitle>
                <span className="font-mono text-xs text-muted-foreground">
                  {selectedJob.outputs.length}
                </span>
              </PanelHeader>
              <PanelBody className="space-y-3">
                {selectedJob.outputs.map((output) => (
                  <div
                    key={output.id}
                    className="rounded-lg border border-border p-4"
                  >
                    <p className="font-mono text-xs text-muted-foreground">
                      {output.reference}
                    </p>
                    <ValueTree className="mt-2" value={output.value} />
                  </div>
                ))}
              </PanelBody>
            </Panel>
          : null}
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader>
              <PanelTitle>What you submitted</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-4">
              {body.fields.map((field) => (
                <div key={field.key} className="min-w-0">
                  {/* A body that is a single unnamed answer has nothing to put
                      here, and the panel's own heading already names it. */}
                  {field.label ?
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {field.label}
                    </p>
                  : null}
                  {field.file ?
                    <div className="mt-1.5 flex items-center gap-3 rounded-lg border border-border bg-muted px-3 py-2.5">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand-subtle font-mono text-[10px] font-bold text-primary">
                        FILE
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {field.file.name}
                        </span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {formatBytes(field.file.size)}
                        </span>
                      </span>
                      {/* TODO(files): needs a route that resolves a FileRef to
                          a signed URL for whoever owns it. */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        disabled
                      >
                        <Download className="size-3.5" />
                      </Button>
                    </div>
                  : <ValueTree
                      className={cn(field.label && "mt-1")}
                      value={field.value}
                    />
                  }
                </div>
              ))}
            </PanelBody>
            <RawDisclosure label="Raw submission body" value={detail.body} />
          </Panel>

          {/* Under what they submitted, because that is what this is about: where
              the contents actually came from, which the body alone cannot say
              once a form field holds a ref or a file reference. */}
          <SurfaceSlot
            surface={surface.std.submissionDetail}
            subject={{ submission: detail.id }}
          />

          <Panel>
            <PanelHeader>
              <PanelTitle>Track</PanelTitle>
            </PanelHeader>
            {/* TODO(standings): the mockup also shows this submission's rank and
                the leader's score. Both need a leaderboard read keyed by
                submission, which `getCompetitionStandings` does not do. */}
            <div className="flex flex-col">
              <Link
                to="/competitions/$id/tracks/$trackId"
                params={{ id: detail.competitionId, trackId: detail.trackId }}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm font-medium hover:bg-muted"
              >
                Open track
                <ArrowUpRight className="size-4 text-muted-foreground" />
              </Link>
              <Link
                to="/competitions/$id/leaderboards"
                params={{ id: detail.competitionId }}
                className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm font-medium hover:bg-muted"
              >
                Leaderboards
                <ArrowUpRight className="size-4 text-muted-foreground" />
              </Link>
              <Link
                to="/competitions/$id/submissions"
                params={{ id: detail.competitionId }}
                className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm font-medium hover:bg-muted"
              >
                Your submissions here
                <ArrowUpRight className="size-4 text-muted-foreground" />
              </Link>
            </div>
          </Panel>

          {/* Running again scores the same submission, so the header carries
              both that and the way to send a different one. */}
        </div>
      </div>
      </PageBody>
    </>
  );
}
