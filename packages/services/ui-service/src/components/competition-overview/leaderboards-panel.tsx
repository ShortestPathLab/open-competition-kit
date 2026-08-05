import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { LeaderboardSummary } from "@/lib/leaderboard-fn";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Trophy } from "lucide-react";

export function LeaderboardsPanel({
  competitionId,
  leaderboards,
}: {
  competitionId: string;
  leaderboards: LeaderboardSummary[] | undefined;
}) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Leaderboards</PanelTitle>
        {leaderboards?.length ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0"
            render={<Link to="/competitions/$id/leaderboards" params={{ id: competitionId }} />}
          >
            All
          </Button>
        ) : null}
      </PanelHeader>
      <PanelBody className="p-3">
        {leaderboards?.length ? (
          <div className="flex flex-col">
            {leaderboards.map((lb) => (
              <Link
                key={lb.id}
                to="/competitions/$id/leaderboards"
                params={{ id: competitionId }}
                hash={lb.id}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{lb.name}</span>
                  {lb.description ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {lb.description}
                    </span>
                  ) : null}
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        ) : (
          <Empty className="border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>No leaderboards yet</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </PanelBody>
    </Panel>
  );
}
