import { Button } from "*/components/ui/button";
import { DataBrowser, type DataBrowserFilterOption } from "*/components/data-browser";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "*/components/ui/item";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { EnrolmentSummary } from "src/lib/competition-data";
import { useMemo } from "react";

interface EnrolmentBrowserProps {
  enrolments: EnrolmentSummary[];
  isSessionLoading: boolean;
  isSignedIn: boolean;
  isLoading: boolean;
}

function deriveTrackOptions(
  enrolments: EnrolmentSummary[],
): DataBrowserFilterOption[] {
  const byId = new Map<string, DataBrowserFilterOption>();
  enrolments.forEach((enrolment) => {
    if (!byId.has(enrolment.track.id)) {
      byId.set(enrolment.track.id, {
        value: enrolment.track.id,
        label: `${enrolment.competition.name} / ${enrolment.track.name}`,
      });
    }
  });
  return [...byId.values()];
}

export function EnrolmentBrowser({
  enrolments,
  isSessionLoading,
  isSignedIn,
  isLoading,
}: EnrolmentBrowserProps) {
  const trackOptions = useMemo(() => deriveTrackOptions(enrolments), [enrolments]);

  return (
    <DataBrowser
      items={enrolments}
      isSessionLoading={isSessionLoading}
      isSignedIn={isSignedIn}
      isLoading={isLoading}
      searchPlaceholder="Search by track, competition, or description"
      filterOptions={trackOptions}
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
      emptyTitle="No enrolments yet"
      emptyDescription="Pick a competition track to start participating."
      noResultsTitle="No enrolments match your filters"
      noResultsDescription="Try a different search term or switch back to all tracks."
      renderResults={(filteredEnrolments) => (
        <ItemGroup>
          {filteredEnrolments.map((enrolment) => (
            <Item key={enrolment.id} variant="outline">
              <ItemContent>
                <ItemHeader>
                  <div className="min-w-0">
                    <ItemTitle>
                      {enrolment.track.name} - {enrolment.competition.name}
                    </ItemTitle>
                    <p className="text-xs text-muted-foreground">
                      {enrolment.submissions.length} submission
                      {enrolment.submissions.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </ItemHeader>
                <ItemDescription>{enrolment.track.description}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <Link
                      to="/competitions/$id/submissions/new"
                      params={{ id: enrolment.competition.id }}
                      search={{ trackId: enrolment.track.id }}
                    />
                  }
                >
                  Make submission
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <Link
                      to="/competitions/$id/tracks/$trackId"
                      params={{
                        id: enrolment.competition.id,
                        trackId: enrolment.track.id,
                      }}
                    />
                  }
                >
                  Open track
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    />
  );
}
