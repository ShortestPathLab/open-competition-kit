import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "*/components/ui/empty";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { getLeaderboards } from "src/lib/leaderboard-fn";

export const Route = createFileRoute("/leaderboards/")({
  component: LeaderboardsIndexPage,
  loader: async () => {
    const leaderboards = await getLeaderboards();
    const firstLeaderboard = leaderboards[0];

    if (firstLeaderboard) {
      throw redirect({
        to: "/leaderboards/$leaderboardId",
        params: { leaderboardId: firstLeaderboard.id },
      });
    }

    return { leaderboards };
  },
});

function LeaderboardsIndexPage() {
  const { leaderboards } = Route.useLoaderData();

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-6 py-8">
        {leaderboards.length === 0 ? (
          <Empty className="rounded-2xl border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>No leaderboards yet</EmptyTitle>
              <EmptyDescription>
                No leaderboards have been configured for this deployment yet.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
      </main>
    </div>
  );
}
