import { PageHeader } from "*/components/page-header";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "*/components/ui/select";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useKitComponent } from "src/hooks/use-kit-component";
import { getLeaderboards, getLoadedLeaderboard } from "src/lib/leaderboard-fn";

export const Route = createFileRoute("/leaderboards/$leaderboardId")({
  component: LeaderboardPage,
  loader: async ({ params }) => {
    const leaderboards = await getLeaderboards();
    const selectedLeaderboard =
      leaderboards.find(
        (leaderboard) => leaderboard.id === params.leaderboardId,
      ) ?? leaderboards[0];

    if (!selectedLeaderboard) {
      return { leaderboards, selectedLeaderboard: null, leaderboardDef: null };
    }

    if (selectedLeaderboard.id !== params.leaderboardId) {
      throw redirect({
        to: "/leaderboards/$leaderboardId",
        params: { leaderboardId: selectedLeaderboard.id },
      });
    }

    const leaderboardDef = await getLoadedLeaderboard({
      data: selectedLeaderboard.id,
    });

    return { leaderboards, selectedLeaderboard, leaderboardDef };
  },
});

function LeaderboardPage() {
  const router = useRouter();
  const { leaderboards, selectedLeaderboard, leaderboardDef } =
    Route.useLoaderData();

  // Resolve the renderer against *this* leaderboard, not the root config: a
  // board's own `with:` is applied last and so overrides the inherited default,
  // which is what lets one competition mix a table, cards, and a chart.
  const Leaderboard = useKitComponent(
    "leaderboard.ui",
    selectedLeaderboard ?
      { competitions: { leaderboards: selectedLeaderboard.id } }
    : undefined,
  );

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader
          title="Leaderboards"
          description="Track the top performing agents across all active competitions."
          actions={
            selectedLeaderboard ? (
              <Select
                items={leaderboards.map((leaderboard) => ({
                  label: leaderboard.name,
                  value: leaderboard.id,
                }))}
                value={selectedLeaderboard.id}
                onValueChange={(leaderboardId) => {
                  if (!leaderboardId) return;
                  router.navigate({
                    to: "/leaderboards/$leaderboardId",
                    params: { leaderboardId },
                  });
                }}
              >
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="Choose a leaderboard" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectGroup>
                    <SelectLabel>Leaderboards</SelectLabel>
                    {leaderboards.map((leaderboard) => (
                      <SelectItem key={leaderboard.id} value={leaderboard.id}>
                        {leaderboard.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : null
          }
        />

        {selectedLeaderboard && leaderboardDef ? (
          <div className="mt-8">
            <Leaderboard def={leaderboardDef} />
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No leaderboards have been configured yet.
          </div>
        )}
      </main>
    </div>
  );
}
