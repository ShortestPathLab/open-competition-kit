import { createFileRoute, redirect } from "@tanstack/react-router";
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
      <main className="mx-auto max-w-5xl px-6 py-8">
        {leaderboards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No leaderboards have been configured yet.
          </div>
        ) : null}
      </main>
    </div>
  );
}
