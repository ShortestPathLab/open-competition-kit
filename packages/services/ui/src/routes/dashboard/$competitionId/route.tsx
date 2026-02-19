import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CompetitionSelector } from "*/components/competition-selector";
import { SearchInput } from "*/components/search-input";
import { AdminCompetitionTabs } from "../../../../*/components/admin-competition-tabs";

export const Route = createFileRoute("/dashboard/$competitionId")({
  component: AdminCompetitionLayout,
});

function AdminCompetitionLayout() {
  const { competitionId } = Route.useParams();

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-6 py-2">
        <div className="flex items-center gap-4 [view-transition-name:admin-header]">
          <CompetitionSelector name="GPPC 2025" />
          <AdminCompetitionTabs competitionId={competitionId} />
        </div>
        <SearchInput placeholder="Search" className="w-56" />
      </div>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
