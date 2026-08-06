import { AlertTriangle } from "lucide-react";
import { JobStatusBadge } from "@/components/job-status-badge";
import { HeaderStats } from "@/components/page-header-band";
import { Stat } from "@/components/stat-strip";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { CompetitionActivity } from "@/lib/dashboard-data";
import type { JsonValue } from "@/lib/submission-fn";
import { describeJobStatus, formatScore, readResult } from "@/lib/submission-readout";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * An instant, in UTC and in a fixed pattern.
 *
 * Both halves of that are load-bearing. A locale-dependent format gives the
 * server one string and the browser another, and so does a timezone-dependent
 * one: the page is rendered on a host that is rarely in the reader's zone, so
 * hydration would find different text than it rendered on every row carrying a
 * date. Reading in UTC is also the reading that matches how a deadline is
 * written, since the gate packages want an explicit offset on one.
 *
 * The zone is named once in the column heading rather than on every row, which
 * is why it is not in the string.
 */
export function formatWhen(iso: string | null, fallback = "Never"): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
  );
}

/** The day on its own, for a line too narrow to carry a time as well. */
export function formatDay(iso: string | null, fallback = "Never"): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * What a run produced, in the width of a column.
 *
 * A number where there is one, and the status word where there is not. A failed
 * run has no score to print, and printing zero would invent one. The same
 * reading the entrant's own list makes, so an organiser and a competitor see the
 * same submission described the same way.
 */
export function ResultCell({
  runs,
  status,
  result,
  className,
}: {
  runs: number;
  status?: string;
  result: JsonValue | null;
  className?: string;
}) {
  if (runs === 0) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>Not run</span>
    );
  }

  const headline = readResult(result).headline;
  const { tone } = describeJobStatus(status);

  if (headline && tone !== "destructive") {
    return (
      <span
        className={cn(
          "font-mono text-sm font-semibold tabular-nums",
          tone === "success" && "text-success",
          className,
        )}
      >
        {formatScore(headline.value)}
      </span>
    );
  }

  return (
    <span className={className}>
      <JobStatusBadge status={status} />
    </span>
  );
}

/**
 * The competition's totals, as the strip along the bottom of a header band.
 *
 * The same six figures on every dashboard section, so moving between them does
 * not change what the page claims about the competition. They come from one read
 * of the activity, which is also what the list below them is drawn from.
 */
export function ActivityStats({ totals }: { totals?: CompetitionActivity["totals"] }) {
  if (!totals) return null;

  return (
    <HeaderStats>
      <Stat label="Participants" value={totals.participants} />
      <Stat label="Entries" value={totals.enrolments} />
      <Stat label="Submissions" value={totals.submissions} />
      <Stat label="Evaluated" value={totals.evaluated} />
      <Stat
        label="Running"
        value={totals.running}
        className={totals.running > 0 ? "bg-warning/10" : undefined}
      />
      <Stat label="Failed" value={totals.failed} tone={totals.failed > 0 ? "destructive" : undefined} />
    </HeaderStats>
  );
}

/**
 * A read that failed, said as a failure.
 *
 * Every page here has a "nothing found" state, and without this one they answer
 * a broken request with it: a server function that threw leaves the query with
 * no data, which looks exactly like a competition with no participants. That
 * cost an afternoon once already, when a settings page reported a competition
 * missing from a config it was sitting in.
 *
 * The message is shown in full, the way the router's own error page shows it.
 * The ones that reach here are the organiser's to act on: "Forbidden" means the
 * session lapsed, and anything about a missing method means the server is
 * running older code than the page is.
 */
export function QueryFailure({ error }: { error: unknown }) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : typeof error === "string" && error
        ? error
        : "No message came with the error.";

  return (
    <Empty className="rounded-2xl border border-dashed border-destructive/40">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertTriangle className="text-destructive" />
        </EmptyMedia>
        <EmptyTitle>This didn't load</EmptyTitle>
        <EmptyDescription>
          The server refused or failed the request, so nothing below is the real state of the
          competition.
          <span className="mt-2 block font-mono text-xs text-destructive">{message}</span>
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** The column headings above a list of rows, sharing the rows' own grid. */
export function ListHeader({ columns, children }: { columns: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        columns,
        "border-b border-border bg-muted px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
      )}
    >
      {children}
    </div>
  );
}
