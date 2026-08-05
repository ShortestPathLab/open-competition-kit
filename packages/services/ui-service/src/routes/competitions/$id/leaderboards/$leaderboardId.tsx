import { createFileRoute, redirect } from "@tanstack/react-router";
import { ensureLeaderboard } from "@/lib/route-guards";

export const Route = createFileRoute("/competitions/$id/leaderboards/$leaderboardId")({
  // Every board now sits on the one leaderboards page, so this is a permalink
  // rather than a page of its own: links shared while each board had its own URL
  // still land on that board, as an anchor.
  //
  // The id is still checked first. An unknown one used to fall through to the
  // first board, which meant a link to a retired board silently showed a
  // different competitor's standings under the wrong name.
  //
  // In the loader rather than in `beforeLoad` so the competition's header and
  // tabs stay up around the 404: a `notFound` from `beforeLoad` carries no route
  // id and lands on the root boundary instead of this one.
  loader: ({ params, context }) => {
    ensureLeaderboard(context.competition, params.leaderboardId);

    throw redirect({
      to: "/competitions/$id/leaderboards",
      params: { id: params.id },
      hash: params.leaderboardId,
      replace: true,
    });
  },
});
