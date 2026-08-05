import { SearchInput } from "@/components/search-input";
import type { TrackList } from "@/lib/track-list-fn";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

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
        active ? "bg-brand-subtle text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      <span className="font-mono text-xs tabular-nums opacity-70">{count}</span>
    </button>
  );
}

type TrackFiltersProps = Pick<
  TrackList,
  | "search"
  | "setSearch"
  | "filter"
  | "setFilter"
  | "totalCount"
  | "openCount"
  | "enteredCount"
  | "isSignedIn"
>;

export function TrackFilters({
  search,
  setSearch,
  filter,
  setFilter,
  totalCount,
  openCount,
  enteredCount,
  isSignedIn,
}: TrackFiltersProps) {
  return (
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
        <FilterButton active={filter === "all"} count={totalCount} onClick={() => setFilter("all")}>
          All
        </FilterButton>
        <FilterButton
          active={filter === "open"}
          count={openCount}
          onClick={() => setFilter("open")}
        >
          Open now
        </FilterButton>
        {/* Nothing to filter by if nobody is signed in to have entered. */}
        {isSignedIn ? (
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
  );
}
