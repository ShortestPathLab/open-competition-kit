import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CompetitionSelector } from "@/components/competition-selector";
import { AdminCompetitionTabs } from "@/components/admin-competition-tabs";
import { useCompetition } from "@/lib/competition-fn";
import { ensureCompetition } from "@/lib/route-guards";

export const Route = createFileRoute("/dashboard/$competitionId")({
  // The parent `/dashboard` route has already turned away anyone who is not an
  // organiser, so this only has to answer whether the competition is real.
  beforeLoad: async ({ params }) => ({
    competition: await ensureCompetition(params.competitionId),
  }),
  component: AdminCompetitionLayout,
});

function AdminCompetitionLayout() {
  const { competitionId } = Route.useParams();
  const { data: competition } = useCompetition(competitionId);

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2">
          <div className="flex items-center gap-4 [view-transition-name:admin-header]">
            <CompetitionSelector name={competition?.name ?? competitionId} />
            <AdminCompetitionTabs competitionId={competitionId} />
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
