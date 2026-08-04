import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Trophy } from "lucide-react";
import type {
  CompetitionStandings,
  StandingsEntry,
} from "@/lib/leaderboard-fn";

/**
 * A score, shortened enough to sit in a rail without lying about itself.
 *
 * Four decimal places rather than the two the card renderer uses: leaderboards
 * are frequently decided in the third, and rounding 0.9412 and 0.9388 both to
 * 0.94 would show two competitors tied who are not.
 */
function formatScore(score: StandingsEntry["score"]) {
  if (score === null || score === "") return "-";
  if (typeof score === "boolean") return score ? "Yes" : "No";

  const numeric = typeof score === "number" ? score : Number(score);
  if (Number.isNaN(numeric)) return String(score);

  return Number.isInteger(numeric) ?
      numeric.toLocaleString()
    : numeric.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** The top three get their metal. Everyone else gets the muted default. */
const PODIUM = ["text-gold", "text-silver", "text-bronze"] as const;

function StandingsRow({ entry }: { entry: StandingsEntry }) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2",
        entry.isYou && "bg-brand-subtle",
      )}
    >
      <span
        className={cn(
          "text-center font-mono text-xs font-bold tabular-nums",
          PODIUM[entry.rank - 1] ?? "text-muted-foreground",
        )}
      >
        {entry.rank}
      </span>
      <span
        className={cn(
          "truncate text-sm font-medium",
          entry.isYou && "text-primary",
        )}
      >
        {entry.isYou ? `You · ${entry.competitor}` : entry.competitor}
      </span>
      <span className="font-mono text-xs font-semibold tabular-nums">
        {formatScore(entry.score)}
      </span>
    </div>
  );
}

/**
 * One of the competition's leaderboards, cut down to a rail.
 *
 * The board itself is chosen on the server, along with which row belongs to the
 * reader. See `getCompetitionStandings` for why a competition has no single set
 * of standings to show.
 */
export function StandingsPanel({
  competitionId,
  standings,
  isLoading,
}: {
  competitionId: string;
  standings?: CompetitionStandings | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Panel>
        <PanelHeader>
          <PanelTitle>Standings</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-2 p-3">
          {Array.from({ length: 4 }, (_, row) => (
            <Skeleton key={row} className="h-9 w-full rounded-lg" />
          ))}
        </PanelBody>
      </Panel>
    );
  }

  // No ranked board configured. The leaderboards list in the rail below already
  // links to whatever boards do exist, so there is nothing to say here.
  if (!standings) return null;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Standings</PanelTitle>
        {standings.caption ?
          <span className="text-xs text-muted-foreground">
            {standings.caption}
          </span>
        : null}
      </PanelHeader>

      {standings.top.length ?
        <>
          <div className="p-2">
            <div className="divide-y divide-border">
              {standings.top.map((entry) => (
                <StandingsRow key={entry.rank} entry={entry} />
              ))}
            </div>
            {standings.you ?
              // Spliced in below the top rows rather than dropped, so a
              // competitor in 40th still sees where they are without opening
              // the full board.
              <div className="mt-1 border-t border-border pt-1">
                <StandingsRow entry={standings.you} />
              </div>
            : null}
          </div>
          <div className="border-t border-border px-4 py-2.5">
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0"
              render={
                <Link
                  to="/competitions/$id/leaderboards"
                  params={{ id: competitionId }}
                  hash={standings.leaderboardId}
                />
              }
            >
              {standings.total > standings.top.length ?
                `All ${standings.total} competitors`
              : "Full leaderboard"}
              <ArrowRight />
            </Button>
          </div>
        </>
      : <PanelBody>
          <Empty className="border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>No scores yet</EmptyTitle>
              <EmptyDescription>
                {standings.leaderboardName} fills in as submissions are
                evaluated.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </PanelBody>
      }
    </Panel>
  );
}
