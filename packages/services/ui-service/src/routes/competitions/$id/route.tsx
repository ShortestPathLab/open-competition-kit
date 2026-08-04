import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ensureCompetition } from "@/lib/route-guards";

export const Route = createFileRoute("/competitions/$id")({
  // One gate for the whole subtree: every page under this route reads the same
  // competition, so an id that does not exist is a 404 for all of them. The
  // shape goes into the route context, which is where the track and leaderboard
  // pages check their own ids.
  beforeLoad: async ({ params }) => ({
    competition: await ensureCompetition(params.id),
  }),
  component: CompetitionLayout,
});

/**
 * Layout, and nothing more.
 *
 * The competition used to draw its own header here, which every page below
 * inherited: a leaderboard, a track and a submission form all opened with the
 * competition's name, description and call to action, and only then got around
 * to saying which page you were on. Each route now renders its own
 * `CompetitionPageHeader` and names the competition in the breadcrumb, which
 * leaves this holding the subtree together and deciding nothing about how it
 * looks.
 */
function CompetitionLayout() {
  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
}
