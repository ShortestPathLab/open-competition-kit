import { JobStatusBadge } from "@/components/job-status-badge";
import { Stat } from "@/components/stat-strip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import type { SubmissionJob } from "@/lib/submission-fn";
import {
  describeJobStatus,
  formatScore,
  prettyJson,
  readResult,
  type ResultReadout,
} from "@/lib/submission-readout";

/** The id, and a way to take it somewhere else. */
export function CopyId({ value }: { value: string }) {
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
 * leaves the reason to the logs panel rather than printing a zero nobody earned.
 * The score is the one number on this page that is good or bad news.
 */
export function ResultStat({
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
      tone={failed ? "destructive" : readout.headline ? "success" : undefined}
      label={
        failed ? `Run ${runNumber} of ${runCount} failed` : (readout.headline?.label ?? "Result")
      }
      value={
        readout.headline ? (
          formatScore(readout.headline.value)
        ) : (
          <span className="font-sans text-base">
            {readout.present ? "No headline score" : "Not scored yet"}
          </span>
        )
      }
    />
  );
}

/** One run in the strip: which attempt it was, and how it went. */
export function RunCard({
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

  const outcome = readout.headline
    ? `${readout.headline.label.toLowerCase()} ${formatScore(readout.headline.value)}`
    : tone === "destructive"
      ? "no result written"
      : tone === "pending"
        ? "waiting on the runner"
        : `${job.outputs.length} output${job.outputs.length === 1 ? "" : "s"}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-44 shrink-0 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
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
      <p className="mt-1.5 truncate font-mono text-xs text-muted-foreground">{outcome}</p>
    </button>
  );
}

/** The runner's log lines. Dark in both themes, the way a console reads. */
export function LogConsole({ lines }: { lines: string[] }) {
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
          <span className="text-terminal-foreground/35 select-none text-right">{index + 1}</span>
          <span className="wrap-break-word whitespace-pre-wrap">{line}</span>
        </div>
      ))}
    </div>
  );
}

/** A JSON value, kept out of the way until somebody asks for it. */
export function RawDisclosure({ label, value }: { label: string; value: unknown }) {
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
