import { ListSkeleton } from "@/components/skeletons";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { ClipboardList, Lock, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { useDeferredValue, useMemo, useState } from "react";

export type DataBrowserFilterOption = {
  value: string;
  label: string;
};

const filterChipClassName =
  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors";

interface DataBrowserProps<T> {
  items: T[];
  /**
   * Whether the reader is signed in, for a list that is theirs.
   *
   * Leave all three sign-in props out on a list that is not: the organiser
   * dashboard is already behind a route guard and a server-side admin check, so
   * a "sign in to see this" branch there is a state it can never be in.
   */
  isSignedIn?: boolean;
  isSessionLoading?: boolean;
  isLoading: boolean;
  /** Pass `false` for a list short enough that a search box is furniture. */
  searchable?: boolean;
  searchPlaceholder: string;
  /**
   * Chips that narrow the list. An empty array renders no chip row at all,
   * including the "everything" one: a filter with nothing to filter by is a
   * control that cannot do anything.
   */
  filterOptions: DataBrowserFilterOption[];
  /** What the chip that clears the filter says. */
  allLabel?: string;
  /**
   * Which chip this item belongs under. A list is free to answer with several:
   * one participant can be entered in more than one track, and a chip asking
   * "who is in this track" has to match all of them.
   */
  getFilterValue: (item: T) => string | readonly string[];
  matchesSearch: (item: T, query: string) => boolean;
  signInTitle?: string;
  signInDescription?: string;
  loadingLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  noResultsTitle: string;
  noResultsDescription: string;
  /** Controls that belong beside the search box, e.g. an export button. */
  actions?: ReactNode;
  renderResults: (items: T[]) => ReactNode;
}

export function DataBrowser<T>({
  items,
  isSessionLoading = false,
  isSignedIn,
  isLoading,
  searchable = true,
  searchPlaceholder,
  filterOptions,
  allLabel = "All tracks",
  getFilterValue,
  matchesSearch,
  signInTitle,
  signInDescription,
  loadingLabel,
  emptyTitle,
  emptyDescription,
  noResultsTitle,
  noResultsDescription,
  actions,
  renderResults,
}: DataBrowserProps<T>) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const deferredSearch = useDeferredValue(search);

  const filteredItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return items.filter((item) => {
      const belongsTo = getFilterValue(item);
      const matchesFilter =
        filter === "all" ||
        (Array.isArray(belongsTo) ? belongsTo.includes(filter) : belongsTo === filter);
      return matchesFilter && (query.length === 0 || matchesSearch(item, query));
    });
  }, [deferredSearch, filter, getFilterValue, items, matchesSearch]);

  return (
    <div className="flex flex-col gap-3">
      {searchable || filterOptions.length > 0 || actions ? (
        <div className="flex flex-col gap-3">
          {searchable || actions ? (
            <div className="flex flex-wrap items-center gap-2">
              {searchable ? (
                <SearchInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="min-w-64 flex-1"
                />
              ) : null}
              {actions}
            </div>
          ) : null}
          {filterOptions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={cn(
                  filterChipClassName,
                  filter === "all"
                    ? "border-primary bg-primary/8 text-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {allLabel}
              </button>
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    filterChipClassName,
                    filter === option.value
                      ? "border-primary bg-primary/8 text-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {isSessionLoading ? (
        <ListSkeleton aria-label="Loading your account details..." />
      ) : isSignedIn === false ? (
        <Empty className="rounded-2xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Lock />
            </EmptyMedia>
            <EmptyTitle>{signInTitle}</EmptyTitle>
            <EmptyDescription>{signInDescription}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link to="/sign-in" />}>Sign in</Button>
          </EmptyContent>
        </Empty>
      ) : isLoading ? (
        <ListSkeleton aria-label={loadingLabel} />
      ) : filteredItems.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {items.length === 0 ? <ClipboardList /> : <SearchX />}
            </EmptyMedia>
            <EmptyTitle>{items.length === 0 ? emptyTitle : noResultsTitle}</EmptyTitle>
            <EmptyDescription>
              {items.length === 0 ? emptyDescription : noResultsDescription}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        renderResults(filteredItems)
      )}
    </div>
  );
}
