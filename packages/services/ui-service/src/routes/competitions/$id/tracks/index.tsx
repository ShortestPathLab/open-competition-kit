import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { CompetitionPageHeader } from "*/components/competition-page-header";
import { HeaderStats, PageBody } from "*/components/page-header-band";
import { SearchInput } from "*/components/search-input";
import { Stat } from "*/components/stat-strip";
import { isActionable, phaseOf, type Phase } from "*/components/submission-window";
import { useCompetition } from "src/lib/competition-fn";
import { TrackCard } from "*/components/track-card";
import { Button } from "*/components/ui/button";
import { Skeleton } from "*/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "*/components/ui/empty";
import { cn } from "*/lib/utils";
import { Layers3, SearchX } from "lucide-react";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { authClient } from "src/lib/auth-client";
import {
  getCompetitionSummary,
  type TrackSummary,
} from "src/lib/competition-data";
import { describeDuration } from "src/lib/competition-window";
import { useTracksWithReports } from "src/lib/gate-fn";
import { useUserEnrolments } from "src/lib/enrolment-fn";
import { z } from "zod";

export const Route = createFileRoute("/competitions/$id/tracks/")({
  component: TracksPage,
});

const getTracks = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    return (await getCompetitionSummary(id)).tracks;
  });

/**
 * The groups a list of tracks divides into, in the order they matter.
 *
 * "Not open yet" rather than "Opens later", because a track can be blocked by
 * something other than a start date. A competitor who has spent their hourly
 * quota lands here too, and the card underneath says which it is.
 */
const SECTIONS: Array<{
  key: string;
  label: string;
  phases: Phase[];
}> = [
  { key: "now", label: "Open now", phases: ["closing", "open"] },
  { key: "later", label: "Not open yet", phases: ["upcoming"] },
  { key: "closed", label: "Closed", phases: ["closed"] },
];

type Filter = "all" | "open" | "entered";

function FilterButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ?
          "bg-brand-subtle text-primary"
        : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      <span className="font-mono text-xs tabular-nums opacity-70">{count}</span>
    </button>
  );
}

/**
 * The one action that makes sense for the state a track is in.
 *
 * A closed track keeps its row and trades its submit button for a way into the
 * results: the result is the reason to come back after a deadline.
 */
function TrackAction({
  competitionId,
  track,
  phase,
  entered,
}: {
  competitionId: string;
  track: TrackSummary;
  phase: Phase;
  entered: boolean;
}) {
  if (phase === "closed" || phase === "upcoming") {
    return (
      <Button
        variant="outline"
        size="sm"
        render={
          <Link
            to="/competitions/$id/tracks/$trackId"
            params={{ id: competitionId, trackId: track.id }}
          />
        }
      >
        {phase === "closed" ? "View results" : "Read the brief"}
      </Button>
    );
  }

  if (entered) {
    return (
      <Button
        size="sm"
        render={
          <Link
            to="/competitions/$id/submissions/new"
            params={{ id: competitionId }}
            search={{ trackId: track.id }}
          />
        }
      >
        New submission
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      render={
        <Link
          to="/competitions/$id/enrol"
          params={{ id: competitionId }}
          search={{ trackId: track.id }}
        />
      }
    >
      Enter track
    </Button>
  );
}

function TracksPage() {
  const { id } = Route.useParams();
  const { data: competition } = useCompetition(id);
  const { data: session } = authClient.useSession();
  const fetchTracks = useServerFn(getTracks);
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["competitionTracks", id],
    queryFn: () => (fetchTracks as any)({ data: id }),
  });
  // The reader's enrolments, asked for once for the whole list rather than once
  // per row. The track page already runs this query, so it is usually warm.
  const { data: enrolments = [] } = useUserEnrolments(session?.user?.id);
  // What the installed gates say about each track: the pill, the sort order and
  // the section a row lands in all come from here.
  const withReports = useTracksWithReports(
    tracks as TrackSummary[],
    session?.user?.id,
  );

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const deferredSearch = useDeferredValue(search);

  const rows = useMemo(() => {
    const now = Date.now();
    const submissionsByTrack = new Map(
      enrolments
        .filter((enrolment) => enrolment.competition.id === id)
        .map((enrolment) => [enrolment.track.id, enrolment.submissions.length]),
    );

    return withReports.map((track) => ({
      track,
      phase: phaseOf(track.reports, now),
      // `undefined` is "not enrolled", which is not the same as having enrolled
      // and sent nothing.
      submissions: submissionsByTrack.get(track.id),
    }));
  }, [enrolments, id, withReports]);

  const openCount = rows.filter((row) => isActionable(row.phase)).length;
  const enteredCount = rows.filter(
    (row) => row.submissions !== undefined,
  ).length;

  /**
   * The soonest instant any actionable track is counting down to.
   *
   * Reads whatever the gates reported rather than a closing date specifically,
   * so a competition whose tracks are paced by something else still gets a
   * number in the header.
   */
  const nextDeadline = useMemo(() => {
    const now = Date.now();
    const instants = rows
      .filter((row) => isActionable(row.phase))
      .flatMap((row) => row.track.reports)
      .map((report) => report.at)
      .filter((at): at is string => Boolean(at))
      .map((at) => Date.parse(at))
      .filter((at) => at > now)
      .sort((a, b) => a - b);

    return instants.length ? describeDuration(instants[0]! - now) : undefined;
  }, [rows]);

  const visible = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return rows.filter((row) => {
      if (filter === "open" && !isActionable(row.phase)) return false;
      if (filter === "entered" && row.submissions === undefined) return false;
      if (!query) return true;
      return `${row.track.name} ${row.track.description}`
        .toLowerCase()
        .includes(query);
    });
  }, [deferredSearch, filter, rows]);

  /** The soonest instant a track reports, or nothing, which sorts last. */
  const soonestOf = (reports: readonly { at?: string }[]) => {
    const instants = reports
      .map((report) => (report.at ? Date.parse(report.at) : undefined))
      .filter((at): at is number => at !== undefined);
    return instants.length ? Math.min(...instants) : Number.POSITIVE_INFINITY;
  };

  const sections = SECTIONS.map((section) => ({
    ...section,
    // Soonest date first inside a section, so the track that needs you today
    // sits at the top of the page.
    rows: visible
      .filter((row) => section.phases.includes(row.phase))
      .sort(
        (a, b) => soonestOf(a.track.reports) - soonestOf(b.track.reports),
      ),
  })).filter((section) => section.rows.length > 0);

  return (
    <>
      <CompetitionPageHeader
        competitionId={id}
        competitionName={competition?.name}
        title="Tracks"
        description="Participation happens at the track level. Each one has its own window, its own rules, and its own leaderboard."
        meta={
          <HeaderStats>
            <Stat label="Tracks" value={tracks.length} />
            {tracks.length > 0 ? (
              <Stat label="Open now" value={openCount} />
            ) : null}
            {enteredCount > 0 ? (
              <Stat label="You have entered" value={enteredCount} emphasis />
            ) : null}
            {nextDeadline ? (
              <Stat
                label="Next deadline"
                value={<span className="font-sans text-lg">{nextDeadline}</span>}
              />
            ) : null}
          </HeaderStats>
        }
        tabs
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            placeholder="Search tracks"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-56 flex-1"
          />
          <div
            role="group"
            aria-label="Filter tracks"
            className="flex gap-1 rounded-lg border border-border bg-card p-1"
          >
            <FilterButton
              active={filter === "all"}
              count={rows.length}
              onClick={() => setFilter("all")}
            >
              All
            </FilterButton>
            <FilterButton
              active={filter === "open"}
              count={openCount}
              onClick={() => setFilter("open")}
            >
              Open now
            </FilterButton>
            {session?.user ? (
              <FilterButton
                active={filter === "entered"}
                count={enteredCount}
                onClick={() => setFilter("entered")}
              >
                Entered
              </FilterButton>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-6">
          {isLoading ?
            Array.from({ length: 4 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-24 w-full rounded-xl"
                role="status"
                aria-label="Loading"
              />
            ))
          : tracks.length === 0 ?
            <Empty className="rounded-2xl border border-dashed border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Layers3 />
                </EmptyMedia>
                <EmptyTitle>No tracks yet</EmptyTitle>
                <EmptyDescription>
                  This competition doesn't have any tracks published yet.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          : sections.length === 0 ?
            <Empty className="rounded-2xl border border-dashed border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchX />
                </EmptyMedia>
                <EmptyTitle>No tracks match your filters</EmptyTitle>
                <EmptyDescription>
                  Try a different keyword, or switch back to all tracks.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          : sections.map((section) => (
              <section key={section.key} className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {section.label}
                  <span className="font-mono tracking-normal">
                    {section.rows.length}
                  </span>
                </h2>
                {section.rows.map(({ track, phase, submissions }) => (
                  <TrackCard
                    key={track.id}
                    id={track.id}
                    competitionId={id}
                    name={track.name}
                    description={track.description}
                    icon={track.icon}
                    reports={track.reports}
                    submissions={submissions}
                    showEnrolment={Boolean(session?.user)}
                    dim={phase === "closed"}
                    action={
                      <TrackAction
                        competitionId={id}
                        track={track}
                        phase={phase}
                        entered={submissions !== undefined}
                      />
                    }
                  />
                ))}
              </section>
            ))
          }
        </div>
      </PageBody>
    </>
  );
}
