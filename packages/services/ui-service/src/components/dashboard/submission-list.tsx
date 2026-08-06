import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Fragment, useMemo } from "react";
import { DataBrowser, type DataBrowserFilterOption } from "@/components/data-browser";
import { formatWhen, ListHeader, ResultCell } from "@/components/dashboard/parts";
import type { ActivityRow, CompetitionActivity } from "@/lib/dashboard-data";
import { summariseBody, type BodySummary } from "@/lib/submission-readout";
import { cn } from "@/lib/utils";

const ROW_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_3rem_7rem_10rem_1rem] sm:items-center";

/**
 * What was submitted, in the one line a row has under the name.
 *
 * Each answer shrinks on its own rather than the line truncating as a whole, so
 * a long repository name gives up its middle before a short branch name is lost
 * altogether. Read the same way the entrant's own list reads it.
 */
function BodySummaryLine({ summary }: { summary: BodySummary }) {
  const { file, facts } = summary;

  if (!file && facts.length === 0) {
    return <span className="mt-0.5 block text-xs text-muted-foreground">No answers recorded</span>;
  }

  const labelled = facts.length > 1;

  return (
    <span className="mt-0.5 flex items-baseline gap-x-2 text-xs text-muted-foreground">
      {file ? <span className="min-w-0 truncate font-mono">{file}</span> : null}
      {facts.map((fact, index) => (
        <Fragment key={`${fact.label}-${index}`}>
          {file || index > 0 ? (
            <span aria-hidden className="shrink-0">
              &middot;
            </span>
          ) : null}
          <span className="min-w-0 truncate">
            {labelled && fact.label ? `${fact.label} ` : null}
            {fact.value}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

function SubmissionRowLink({
  competitionId,
  row,
  showTrack,
}: {
  competitionId: string;
  row: ActivityRow;
  showTrack: boolean;
}) {
  const summary = summariseBody(row.body);

  return (
    <Link
      to="/dashboard/$competitionId/submissions/$submissionId"
      params={{ competitionId, submissionId: row.id }}
      className={cn(ROW_COLUMNS, "px-4 py-3 transition-colors hover:bg-muted")}
    >
      <span className="min-w-0">
        {/* The competitor leads. An organiser scanning this list is looking for a
            person, where the entrant's own list is looking for an attempt. */}
        <span className="block truncate text-sm font-medium">{row.userName}</span>
        <BodySummaryLine summary={summary} />
      </span>

      <span className="hidden min-w-0 text-sm sm:block">
        {showTrack ? <span className="block truncate">{row.trackName}</span> : null}
        <span className="block truncate text-xs text-muted-foreground">
          Submission {row.number}
        </span>
      </span>

      <span className="hidden text-right font-mono text-sm text-muted-foreground tabular-nums sm:block">
        {row.runs}
      </span>

      <ResultCell
        runs={row.runs}
        status={row.status}
        result={row.result}
        className="justify-self-end"
      />

      <span className="justify-self-end text-sm text-muted-foreground">
        {formatWhen(row.submittedAt, "Unknown")}
      </span>

      <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
    </Link>
  );
}

/**
 * Every submission this competition has taken, newest first.
 *
 * One list across all tracks rather than one per track. An organiser checking
 * whether the runner is keeping up wants the last hour of activity, and that
 * question has no track in it.
 */
export function SubmissionList({
  competitionId,
  rows,
  tracks,
  isLoading,
  /** Off on a page that is already about one track or one person. */
  showTrack = true,
  emptyTitle = "No submissions yet",
  emptyDescription = "Submissions across this competition's tracks appear here as soon as competitors start entering.",
}: {
  competitionId: string;
  rows: ActivityRow[];
  tracks: CompetitionActivity["tracks"];
  isLoading: boolean;
  showTrack?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const filterOptions: DataBrowserFilterOption[] = useMemo(
    () =>
      showTrack && tracks.length > 1
        ? tracks.map((track) => ({ value: track.id, label: track.name }))
        : [],
    [showTrack, tracks],
  );

  return (
    <DataBrowser
      items={rows}
      isLoading={isLoading}
      searchable={rows.length > 8}
      searchPlaceholder="Search by competitor, track, or submission contents"
      filterOptions={filterOptions}
      getFilterValue={(row) => row.trackId}
      matchesSearch={(row, query) =>
        [row.userName, row.user, row.trackName, row.body, row.id]
          .join(" ")
          .toLowerCase()
          .includes(query)
      }
      loadingLabel="Loading submissions..."
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      noResultsTitle="No submissions match your filters"
      noResultsDescription="Try a different search term, or switch back to all tracks."
      renderResults={(filtered) => (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ListHeader columns={ROW_COLUMNS}>
            <span>Competitor</span>
            <span className="hidden sm:block">{showTrack ? "Track" : "Attempt"}</span>
            <span className="hidden text-right sm:block">Runs</span>
            <span className="justify-self-end">Result</span>
            <span className="justify-self-end">Submitted (UTC)</span>
            <span className="hidden sm:block" />
          </ListHeader>
          <div className="divide-y divide-border">
            {filtered.map((row) => (
              <SubmissionRowLink
                key={row.id}
                competitionId={competitionId}
                row={row}
                showTrack={showTrack}
              />
            ))}
          </div>
        </div>
      )}
    />
  );
}
