import { PageHeader } from "*/components/page-header";
import { createFileRoute } from "@tanstack/react-router";
import { useKitComponent } from "src/hooks/use-kit-component";
import { getLoadedForm } from "src/lib/form-fn";
import { getLoadedLeaderboard } from "src/lib/leaderboard-fn";

export const Route = createFileRoute("/leaderboards/")({
  component: LeaderboardsPage,
  loader: async () => {
    const [formDef, leaderboardProps] = await Promise.all([
      getLoadedForm({ data: "main" }),
      getLoadedLeaderboard({ data: "some-leaderboard" }),
    ]);

    return {
      formDef,
      leaderboardProps,
    };
  },
});

function LeaderboardsPage() {
  const Test = useKitComponent("leaderboard.ui");
  const Test2 = useKitComponent("form.ui");
  const { formDef, leaderboardProps } = Route.useLoaderData();

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader
          title="Leaderboards"
          description="Track the top performing agents across all active competitions."
        />
        <Test {...leaderboardProps} />
        <Test2 def={formDef} />
      </main>
    </div>
  );
}
