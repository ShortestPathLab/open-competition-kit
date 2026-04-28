import { SearchInput } from "*/components/search-input";
import { Button } from "*/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "*/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "*/components/ui/select";
import { Link } from "@tanstack/react-router";
import { ClipboardList, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { useDeferredValue, useMemo, useState } from "react";
import type { SubmissionBrowserItem } from "src/lib/submission-fn";

type TrackOption = {
  value: string;
  label: string;
};

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

function deriveTrackOptions(submissions: SubmissionBrowserItem[]): TrackOption[] {
  const byId = new Map<string, TrackOption>();
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
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState("all");
  const deferredSearch = useDeferredValue(search);
  const trackOptions = useMemo(() => deriveTrackOptions(submissions), [submissions]);

  const filteredSubmissions = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return submissions.filter((submission) => {
      const matchesTrack =
        trackFilter === "all" || submission.trackId === trackFilter;
      const haystack = [
        submission.id,
        submission.trackName,
        submission.competitionName,
        submission.body,
      ]
        .join(" ")
        .toLowerCase();
      return matchesTrack && (query.length === 0 || haystack.includes(query));
    });
  }, [deferredSearch, submissions, trackFilter]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full"
        />
        <Select
          value={trackFilter}
          onValueChange={(value) => setTrackFilter(value ?? "all")}
        >
          <SelectTrigger className="w-full md:w-72">
            <SelectValue placeholder="Filter by track" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tracks</SelectItem>
            {trackOptions.map((track) => (
              <SelectItem key={track.value} value={track.value}>
                {track.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isSessionLoading ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Loading your account details...
        </div>
      ) : !isSignedIn ? (
        <div className="rounded-2xl border border-dashed border-border p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                Sign in to view your submissions
              </h3>
              <p className="text-sm text-muted-foreground">
                Once you participate in a competition, your work will show up
                here.
              </p>
            </div>
            <Button render={<Link to="/sign-in" />}>Sign in</Button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Loading your submissions...
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            {submissions.length === 0 ? (
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            ) : (
              <SearchX className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {submissions.length === 0 ? emptyTitle : noResultsTitle}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {submissions.length === 0 ? emptyDescription : noResultsDescription}
          </p>
        </div>
      ) : (
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
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {submission.id}
                  </p>
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
    </div>
  );
}
