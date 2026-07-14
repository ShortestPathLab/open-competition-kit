import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CompetitionSelector } from "*/components/competition-selector";
import { AdminCompetitionTabs } from "../../../../*/components/admin-competition-tabs";
import { useCompetition } from "src/lib/competition-fn";

export const Route = createFileRoute("/dashboard/$competitionId")({
  component: AdminCompetitionLayout,
});

function AdminCompetitionLayout() {
  const { competitionId } = Route.useParams();
  const { data: competition } = useCompetition(competitionId);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-6 py-2">
        <div className="flex items-center gap-4 [view-transition-name:admin-header]">
          <CompetitionSelector name={competition?.name ?? competitionId} />
          <AdminCompetitionTabs competitionId={competitionId} />
        </div>
      </div>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
