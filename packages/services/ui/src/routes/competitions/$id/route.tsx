import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Navbar } from "*/components/navbar";
import { PageHeader } from "*/components/page-header";
import { CompetitionTabs } from "*/components/competition-tabs";

export const Route = createFileRoute("/competitions/$id")({
  component: CompetitionLayout,
});

function CompetitionLayout() {
  const { id } = Route.useParams();

  return (
    <div className="min-h-screen">
      <Navbar variant="public" />
      <div className="border-b border-border" />
      <div className="bg-muted/30 border-b border-border">
        <div className="mx-auto max-w-5xl px-6 pt-8 pb-0">
          <PageHeader
            title="GPPC 2025"
            description="Smth smth smth"
            actions={
              <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
                Participate in this competition
              </button>
            }
          />
          <div className="mt-6">
            <CompetitionTabs competitionId={id} />
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
