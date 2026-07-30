import {
  DataBrowser,
  type DataBrowserFilterOption,
} from "*/components/data-browser";
import { JobStatusBadge } from "*/components/job-status-badge";
import { Skeleton } from "*/components/ui/skeleton";
import { cn } from "*/lib/utils";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import type {
  SubmissionBrowserItem,
  SubmissionOutcome,
} from "src/lib/submission-fn";
import {
  describeJobStatus,
  formatScore,
  readResult,
  summariseBody,
} from "src/lib/submission-readout";

interface SubmissionBrowserProps {
  submissions: SubmissionBrowserItem[];
  isSessionLoading: boolean;
  isSignedIn: boolean;
  isLoading: boolean;
  /**
   * What each submission's newest run produced, keyed by submission id. Loaded
   * separately from the list, so the result column can arrive late.
   */
  outcomes?: Record<string, SubmissionOutcome>;
  outcomesLoading?: boolean;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  noResultsTitle?: string;
  noResultsDescription?: string;
}

function deriveTrackOptions(
  submissions: SubmissionBrowserItem[],
): DataBrowserFilterOption[] {
  const byId = new Map<string, DataBrowserFilterOption>();
  submissions.forEach((submission) => {
    if (!byId.has(submission.trackId)) {
      byId.set(submission.trackId, {
        value: submission.trackId,
        label: `${submission.competitionName} / ${submission.trackName}`,
      });
    }
  });
  return [...byId.values()];
}

const ROW_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_3.5rem_7rem_1rem] sm:items-center";

/** What the newest run produced, in the width of a column. */
function ResultCell({
  outcome,
  loading,
}: {
  outcome?: SubmissionOutcome;
  loading: boolean;
}) {
  if (loading && !outcome) {
    return <Skeleton className="h-5 w-16 justify-self-end" aria-label="Loading result" />;
  }

  if (!outcome || outcome.runs === 0) {
    return (
      <span className="justify-self-end text-sm text-muted-foreground">
        Not run
      </span>
    );
  }

  const headline = readResult(outcome.result).headline;
  const { tone } = describeJobStatus(outcome.status);

  // A number where there is one, and the status word where there is not. A
  // failed run has no score to print, and printing zero would invent one.
  if (headline && tone !== "destructive") {
    return (
      <span
        className={cn(
          "justify-self-end font-mono text-sm font-semibold tabular-nums",
          tone === "success" && "text-success",
        )}
      >
        {formatScore(headline.value)}
      </span>
    );
  }

  return (
    <span className="justify-self-end">
      <JobStatusBadge status={outcome.status} />
    </span>
  );
}

function SubmissionRow({
  submission,
  outcome,
  outcomesLoading,
  showCompetition,
}: {
  submission: SubmissionBrowserItem;
  outcome?: SubmissionOutcome;
  outcomesLoading: boolean;
  showCompetition: boolean;
}) {
  const summary = summariseBody(submission.body);

  return (
    <Link
      to="/me/submissions/$submissionId"
      params={{ submissionId: submission.id }}
      className={cn(ROW_COLUMNS, "px-4 py-3 transition-colors hover:bg-muted")}
    >
      <span className="min-w-0">
        <span className="block font-mono text-sm font-medium">
          {submission.id}
        </span>
        {/* The body is `JSON.stringify` of the form values, so the row reads
            the file and the first written answer out of it rather than
            clamping three lines of punctuation. */}
        <span className="mt-0.5 block truncate text-sm text-muted-foreground">
          {summary.file ? (
            <span className="font-mono text-foreground">{summary.file}</span>
          ) : null}
          {summary.file && summary.text ? " · " : null}
          {summary.text}
        </span>
      </span>

      <span className="hidden min-w-0 text-sm sm:block">
        <span className="block truncate">{submission.trackName}</span>
        {showCompetition ? (
          <span className="block truncate text-xs text-muted-foreground">
            {submission.competitionName}
          </span>
        ) : null}
      </span>

      <span className="hidden text-right font-mono text-sm text-muted-foreground tabular-nums sm:block">
        {outcome?.runs ?? 0}
      </span>

      <ResultCell outcome={outcome} loading={outcomesLoading} />

      <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
    </Link>
  );
}

/**
 * Every submission the reader has made, as a ledger.
 *
 * The id leads because it is the only thing that tells two submissions to the
 * same track apart. The track name used to be the row's title, which made five
 * attempts at one assignment five identical headings.
 */
export function SubmissionBrowser({
  submissions,
  isSessionLoading,
  isSignedIn,
  isLoading,
  outcomes,
  outcomesLoading = false,
  searchPlaceholder = "Search by submission ID, track, or content",
  emptyTitle = "No submissions yet",
  emptyDescription = "Create a submission to start building your history.",
  noResultsTitle = "No submissions match your filters",
  noResultsDescription = "Try a different search term or switch back to all tracks.",
}: SubmissionBrowserProps) {
  const trackOptions = useMemo(
    () => deriveTrackOptions(submissions),
    [submissions],
  );
  // Only worth a line of its own when the list spans more than one competition.
  const showCompetition = useMemo(
    () =>
      new Set(submissions.map((submission) => submission.competitionId)).size >
      1,
    [submissions],
  );

  return (
    <DataBrowser
      items={submissions}
      isSessionLoading={isSessionLoading}
      isSignedIn={isSignedIn}
      isLoading={isLoading}
      searchPlaceholder={searchPlaceholder}
      filterOptions={trackOptions}
      getFilterValue={(submission) => submission.trackId}
      matchesSearch={(submission, query) =>
        [
          submission.id,
          submission.trackName,
          submission.competitionName,
          submission.body,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)
      }
      signInTitle="Sign in to view your submissions"
      signInDescription="Once you participate in a competition, your work will show up here."
      loadingLabel="Loading your submissions..."
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      noResultsTitle={noResultsTitle}
      noResultsDescription={noResultsDescription}
      renderResults={(filtered) => (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div
            className={cn(
              ROW_COLUMNS,
              "border-b border-border bg-muted px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
            )}
          >
            <span>Submission</span>
            <span className="hidden sm:block">Track</span>
            <span className="hidden text-right sm:block">Runs</span>
            <span className="justify-self-end">Result</span>
            <span className="hidden sm:block" />
          </div>
          <div className="divide-y divide-border">
            {/* Newest first. `listUserSubmissions` returns them in creation
                order, which is the only ordering available: no record in the
                kit carries a created instant yet.
                TODO(api): a `createdAt` on a submission would give this list a
                When column and let it group by day, as the mockup does. */}
            {[...filtered].reverse().map((submission) => (
              <SubmissionRow
                key={submission.id}
                submission={submission}
                outcome={outcomes?.[submission.id]}
                outcomesLoading={outcomesLoading}
                showCompetition={showCompetition}
              />
            ))}
          </div>
        </div>
      )}
    />
  );
}
