import {
  DataBrowser,
  type DataBrowserFilterOption,
} from "*/components/data-browser";
import { CompetitionIcon } from "*/components/entity-icon";
import { Panel, PanelHeader, PanelTitle } from "*/components/panel";
import { phaseOf, WindowStatus } from "*/components/submission-window";
import { Button } from "*/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { EnrolmentSummary } from "src/lib/competition-data";
import type { GateReport } from "@open-competition-kit/sdk/gate";
import { formatScore } from "src/lib/submission-readout";
import { useMemo } from "react";

/** The newest result for a track, when the outcomes query has produced one. */
export type EnrolmentResult = { label: string; value: number };

interface EnrolmentBrowserProps {
  enrolments: EnrolmentSummary[];
  isSessionLoading: boolean;
  isSignedIn: boolean;
  isLoading: boolean;
  /** Keyed by track id. A missing entry just shows the submission count. */
  results?: Record<string, EnrolmentResult | undefined>;
  /**
   * What the installed gates say about each track, keyed by track id.
   *
   * Passed in rather than fetched here, so the page that already asked about
   * these tracks for its own header does not ask a second time.
   */
  reports?: Record<string, GateReport[] | undefined>;
}

type Group = {
  competition: EnrolmentSummary["competition"];
  enrolments: EnrolmentSummary[];
  submissions: number;
};

/**
 * Enrolments gathered under the competition each one belongs to.
 *
 * An enrolment is a track inside a competition, so the list nests the way the
 * data does. Flattened, the competition's name appeared in every row and the
 * whole page read as one long repeated string.
 */
function groupByCompetition(enrolments: EnrolmentSummary[]): Group[] {
  const groups = new Map<string, Group>();

  for (const enrolment of enrolments) {
    const existing = groups.get(enrolment.competition.id);
    if (existing) {
      existing.enrolments.push(enrolment);
      existing.submissions += enrolment.submissions.length;
    } else {
      groups.set(enrolment.competition.id, {
        competition: enrolment.competition,
        enrolments: [enrolment],
        submissions: enrolment.submissions.length,
      });
    }
  }

  return [...groups.values()];
}

function EnrolmentRow({
  enrolment,
  reports,
  result,
}: {
  enrolment: EnrolmentSummary;
  reports: readonly GateReport[];
  result?: EnrolmentResult;
}) {
  const { track, competition } = enrolment;
  const phase = phaseOf(reports, Date.now());

  return (
    <div className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_11rem_8rem_auto] sm:items-center">
      <div className="min-w-0">
        <Link
          to="/competitions/$id/tracks/$trackId"
          params={{ id: competition.id, trackId: track.id }}
          className="text-sm font-semibold hover:text-primary"
        >
          {track.name}
        </Link>
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
          {track.description}
        </p>
      </div>

      <WindowStatus reports={reports} />

      <div className="text-sm text-muted-foreground">
        {result ? result.label : "Submissions"}
        <b className="mt-0.5 block font-mono text-base font-semibold text-foreground tabular-nums">
          {result ? formatScore(result.value) : enrolment.submissions.length}
        </b>
      </div>

      <div className="flex items-center gap-2">
        {phase === "closed" ?
          // The button stays and says why rather than vanishing, which would
          // leave a closed row looking broken.
          <Button variant="outline" size="sm" disabled>
            Closed
          </Button>
        : phase === "upcoming" ?
          <Button size="sm" disabled>
            Not open yet
          </Button>
        : <Button
            size="sm"
            render={
              <Link
                to="/competitions/$id/submissions/new"
                params={{ id: competition.id }}
                search={{ trackId: track.id }}
              />
            }
          >
            {enrolment.submissions.length === 0 ?
              "First submission"
            : "New submission"}
          </Button>
        }
        <Button
          variant="outline"
          size="sm"
          render={
            <Link
              to="/competitions/$id/tracks/$trackId"
              params={{ id: competition.id, trackId: track.id }}
            />
          }
        >
          Open track
          <ArrowUpRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * No chips. They were derived from the enrolled tracks themselves, so each one
 * narrowed the list to exactly one row. Grouping by competition does the work
 * they were pretending to do.
 */
const NO_FILTERS: DataBrowserFilterOption[] = [];

/** Stable identity for a track nothing has reported on yet. */
const NO_REPORTS: GateReport[] = [];

export function EnrolmentBrowser({
  enrolments,
  isSessionLoading,
  isSignedIn,
  isLoading,
  results,
  reports,
}: EnrolmentBrowserProps) {
  // Search earns its place once the list is longer than a screen.
  const searchable = enrolments.length > 6;
  const groups = useMemo(() => groupByCompetition(enrolments), [enrolments]);

  return (
    <DataBrowser
      items={enrolments}
      isSessionLoading={isSessionLoading}
      isSignedIn={isSignedIn}
      isLoading={isLoading}
      searchable={searchable}
      searchPlaceholder="Search by track, competition, or description"
      filterOptions={NO_FILTERS}
      getFilterValue={(enrolment) => enrolment.track.id}
      matchesSearch={(enrolment, query) =>
        [
          enrolment.track.name,
          enrolment.competition.name,
          enrolment.track.description,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)
      }
      signInTitle="Sign in to see enrolments"
      signInDescription="Your competition participation is attached to your account."
      loadingLabel="Loading enrolments..."
      emptyTitle="You have not entered a track yet"
      emptyDescription="Entering a track is what puts a competition on this page."
      noResultsTitle="No enrolments match your search"
      noResultsDescription="Try a different track or competition name."
      renderResults={(filtered) => (
        <div className="flex flex-col gap-4">
          {(searchable ? groupByCompetition(filtered) : groups).map((group) => (
            <Panel key={group.competition.id}>
              <PanelHeader className="flex-nowrap gap-3">
                <CompetitionIcon
                  name={group.competition.name}
                  icon={group.competition.icon}
                  className="size-8 rounded-lg"
                />
                <div className="min-w-0 flex-1">
                  <PanelTitle>
                    <Link
                      to="/competitions/$id"
                      params={{ id: group.competition.id }}
                      className="hover:text-primary"
                    >
                      {group.competition.name}
                    </Link>
                  </PanelTitle>
                  <p className="text-xs text-muted-foreground">
                    {group.competition.organiser}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                  {group.enrolments.length}{" "}
                  {group.enrolments.length === 1 ? "track" : "tracks"} &middot;{" "}
                  {group.submissions}{" "}
                  {group.submissions === 1 ? "submission" : "submissions"}
                </span>
              </PanelHeader>
              <div className="divide-y divide-border">
                {group.enrolments.map((enrolment) => (
                  <EnrolmentRow
                    key={enrolment.id}
                    enrolment={enrolment}
                    reports={reports?.[enrolment.track.id] ?? NO_REPORTS}
                    result={results?.[enrolment.track.id]}
                  />
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}
    />
  );
}
