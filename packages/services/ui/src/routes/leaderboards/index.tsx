import { PageHeader } from "*/components/page-header";
import { createFileRoute } from "@tanstack/react-router";
import { useKitComponent } from "src/hooks/use-kit-component";

export const Route = createFileRoute("/leaderboards/")({
  component: LeaderboardsPage,
});

function LeaderboardsPage() {
  const Test = useKitComponent("leaderboard.ui");
  const Test2 = useKitComponent("form.ui");
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader
          title="Leaderboards"
          description="Track the top performing agents across all active competitions."
        />
        <Test />
        <Test2 />
      </main>
    </div>
  );
}
