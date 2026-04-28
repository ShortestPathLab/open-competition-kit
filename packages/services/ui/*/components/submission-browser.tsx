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
import type { ReactNode } from "react";
import { useMemo } from "react";
import type { SubmissionBrowserItem } from "src/lib/submission-fn";

interface SubmissionBrowserProps {
  submissions: SubmissionBrowserItem[];
  isSessionLoading: boolean;
  isSignedIn: boolean;
  isLoading: boolean;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  noResultsTitle?: string;
  noResultsDescription?: string;
  renderActions?: (submission: SubmissionBrowserItem) => ReactNode;
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

export function SubmissionBrowser({
  submissions,
  isSessionLoading,
  isSignedIn,
  isLoading,
  searchPlaceholder = "Search by submission ID, track, or content",
  emptyTitle = "No submissions yet",
  emptyDescription = "Create a submission to start building your history.",
  noResultsTitle = "No submissions match your filters",
  noResultsDescription = "Try a different search term or switch back to all tracks.",
  renderActions,
}: SubmissionBrowserProps) {
  const trackOptions = useMemo(
    () => deriveTrackOptions(submissions),
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
      renderResults={(filteredSubmissions) => (
        <ItemGroup className="gap-2">
          {filteredSubmissions.map((submission) => (
            <Item key={submission.id} variant="outline">
              <ItemContent>
                <ItemHeader>
                  <div className="min-w-0">
                    <ItemTitle>
                      <Link
                        to="/me/submissions/$submissionId"
                        params={{ submissionId: submission.id }}
                        className="hover:text-primary"
                      >
                        {submission.trackName}
                      </Link>
                    </ItemTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {submission.competitionName}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {submission.id}
                    </p>
                  </div>
                </ItemHeader>
                <ItemDescription className="line-clamp-3 break-all">
                  {submission.body}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                {renderActions?.(submission)}
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <Link
                      to="/me/submissions/$submissionId"
                      params={{ submissionId: submission.id }}
                    />
                  }
                >
                  View submission
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    />
  );
}
