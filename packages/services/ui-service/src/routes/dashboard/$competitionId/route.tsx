import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ensureCompetition } from "@/lib/route-guards";

export const Route = createFileRoute("/dashboard/$competitionId")({
  // The parent `/dashboard` route has already turned away anyone who is not an
  // organiser, so this only has to answer whether the competition is real.
  beforeLoad: async ({ params }) => ({
    competition: await ensureCompetition(params.competitionId),
  }),
  component: AdminCompetitionLayout,
});

/**
 * Layout, and nothing more.
 *
 * This used to draw one bar for the whole dashboard, which every page below
 * inherited: the overview, the participants list and the settings all opened
 * with the competition's name and a tab strip and never said which page you were
 * on. Each route now renders its own `AdminPageHeader`, the same way the
 * competition and personal areas work.
 */
function AdminCompetitionLayout() {
  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
}
