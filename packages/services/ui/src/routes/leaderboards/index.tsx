import { PageHeader } from "*/components/page-header";
import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/leaderboards/")({
  component: LeaderboardsPage,
});

function LeaderboardsPage() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader
          title="Leaderboards"
          description="Track the top performing agents across all active competitions."
        />
        <div className="mt-12 flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">
            Leaderboards coming soon
          </h2>
          <p className="mt-2 text-muted-foreground">
            This leaderboard will track the top performing agents across all
            active competitions. Stay tuned for more updates!
          </p>
        </div>
      </main>
    </div>
  );
}
