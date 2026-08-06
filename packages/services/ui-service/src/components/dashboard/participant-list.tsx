import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { DataBrowser, type DataBrowserFilterOption } from "@/components/data-browser";
import { formatWhen, ListHeader } from "@/components/dashboard/parts";
import type { CompetitionActivity, ParticipantRow } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

const ROW_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_4rem_4rem_10rem_1rem] sm:items-center";

function ParticipantRowLink({
  competitionId,
  participant,
}: {
  competitionId: string;
  participant: ParticipantRow;
}) {
  return (
    <Link
      to="/dashboard/$competitionId/participants/$user"
      params={{ competitionId, user: participant.user }}
      className={cn(ROW_COLUMNS, "px-4 py-3 transition-colors hover:bg-muted")}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{participant.userName}</span>
        {/* The kit keys people by email, so the id under the name is the address
            an organiser would write to. Shown only when it says something the
            name did not. */}
        {participant.user !== participant.userName ? (
          <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
            {participant.user}
          </span>
        ) : null}
      </span>

      <span className="hidden min-w-0 text-sm text-muted-foreground sm:block">
        {participant.tracks.length === 0
          ? "No tracks"
          : participant.tracks.map((track) => track.name).join(", ")}
      </span>

      <span className="hidden text-right font-mono text-sm tabular-nums sm:block">
        {participant.submissions}
      </span>

      <span className="hidden text-right font-mono text-sm text-muted-foreground tabular-nums sm:block">
        {participant.runs}
      </span>

      <span className="justify-self-end text-sm text-muted-foreground">
        {formatWhen(participant.lastSubmittedAt, "No submissions")}
      </span>

      <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
    </Link>
  );
}

/**
 * Everybody who has entered this competition.
 *
 * Ordered by who submitted most recently, because that is the question an
 * organiser opens this page with. Somebody who enrolled and never submitted
 * still appears: they are a participant, and a list that hid them would make an
 * empty track look like an unpopular one.
 */
export function ParticipantList({
  competitionId,
  participants,
  tracks,
  isLoading,
}: {
  competitionId: string;
  participants: ParticipantRow[];
  tracks: CompetitionActivity["tracks"];
  isLoading: boolean;
}) {
  const filterOptions: DataBrowserFilterOption[] = useMemo(
    // One track means every row would match the only chip, so the row is dropped.
    () =>
      tracks.length > 1 ? tracks.map((track) => ({ value: track.id, label: track.name })) : [],
    [tracks],
  );

  return (
    <DataBrowser
      items={participants}
      isLoading={isLoading}
      searchable={participants.length > 8}
      searchPlaceholder="Search by name or email"
      filterOptions={filterOptions}
      // A participant can be in several tracks, so the chip asks whether they are
      // in this one rather than which single track they belong to.
      getFilterValue={(participant) => participant.tracks.map((track) => track.id)}
      matchesSearch={(participant, query) =>
        `${participant.userName} ${participant.user}`.toLowerCase().includes(query)
      }
      loadingLabel="Loading participants..."
      emptyTitle="Nobody has entered yet"
      emptyDescription="Participants appear here as soon as somebody enters one of this competition's tracks."
      noResultsTitle="No participants match your filters"
      noResultsDescription="Try a different name, or switch back to all tracks."
      renderResults={(filtered) => (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ListHeader columns={ROW_COLUMNS}>
            <span>Participant</span>
            <span className="hidden sm:block">Tracks</span>
            <span className="hidden text-right sm:block">Subs</span>
            <span className="hidden text-right sm:block">Runs</span>
            <span className="justify-self-end">Last submission (UTC)</span>
            <span className="hidden sm:block" />
          </ListHeader>
          <div className="divide-y divide-border">
            {filtered.map((participant) => (
              <ParticipantRowLink
                key={participant.user}
                competitionId={competitionId}
                participant={participant}
              />
            ))}
          </div>
        </div>
      )}
    />
  );
}
