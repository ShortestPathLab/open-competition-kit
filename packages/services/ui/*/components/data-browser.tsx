import { SearchInput } from "*/components/search-input";
import { Button } from "*/components/ui/button";
import { cn } from "*/lib/utils";
import { Link } from "@tanstack/react-router";
import { ClipboardList, SearchX } from "lucide-react";
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
  isSessionLoading: boolean;
  isSignedIn: boolean;
  isLoading: boolean;
  searchPlaceholder: string;
  filterOptions: DataBrowserFilterOption[];
  getFilterValue: (item: T) => string;
  matchesSearch: (item: T, query: string) => boolean;
  signInTitle: string;
  signInDescription: string;
  loadingLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  noResultsTitle: string;
  noResultsDescription: string;
  renderResults: (items: T[]) => ReactNode;
}

export function DataBrowser<T>({
  items,
  isSessionLoading,
  isSignedIn,
  isLoading,
  searchPlaceholder,
  filterOptions,
  getFilterValue,
  matchesSearch,
  signInTitle,
  signInDescription,
  loadingLabel,
  emptyTitle,
  emptyDescription,
  noResultsTitle,
  noResultsDescription,
  renderResults,
}: DataBrowserProps<T>) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const deferredSearch = useDeferredValue(search);

  const filteredItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter = filter === "all" || getFilterValue(item) === filter;
      return matchesFilter && (query.length === 0 || matchesSearch(item, query));
    });
  }, [deferredSearch, filter, getFilterValue, items, matchesSearch]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full"
        />
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
            All tracks
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
                {signInTitle}
              </h3>
              <p className="text-sm text-muted-foreground">
                {signInDescription}
              </p>
            </div>
            <Button render={<Link to="/sign-in" />}>Sign in</Button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          {loadingLabel}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            {items.length === 0 ? (
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            ) : (
              <SearchX className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {items.length === 0 ? emptyTitle : noResultsTitle}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {items.length === 0 ? emptyDescription : noResultsDescription}
          </p>
        </div>
      ) : (
        renderResults(filteredItems)
      )}
    </div>
  );
}
