import { Button } from "*/components/ui/button";
import { CompetitionPageHeader } from "*/components/competition-page-header";
import { HeaderMeta, PageBody } from "*/components/page-header-band";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "*/components/ui/empty";
import { Skeleton } from "*/components/ui/skeleton";
import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useCompetition } from "src/lib/competition-fn";
import { TriangleAlert, Trophy } from "lucide-react";
import { useEffect } from "react";
import { useKitComponent } from "src/hooks/use-kit-component";
import {
  getCompetitionLeaderboards,
  useLoadedLeaderboard,
  type LeaderboardSummary,
} from "src/lib/leaderboard-fn";

export const Route = createFileRoute("/competitions/$id/leaderboards/")({
  component: LeaderboardsPage,
  // Only the summaries, which come straight from the config. Each board's rows
  // are a separate query inside its own section, so a slow or failing board
  // holds up nothing but its own patch of the page.
  loader: async ({ params }) => ({
    leaderboards: await getCompetitionLeaderboards({ data: params.id }),
  }),
});

/** Anything the reader does with the page hands the scroll back to them. */
const HANDOVER_EVENTS = ["wheel", "touchmove", "keydown"] as const;

/**
 * Holds an anchored board in view while the rest of the page arrives.
 *
 * A link to one board scrolls to it immediately, while every board is still a
 * skeleton, and a skeleton is shorter than the standings that replace it. Every
 * board above the anchor pushed it further down as it filled in, so a shared
 * link landed on the middle of a different board. This holds the anchor where
 * it was asked for until the page stops changing shape, and lets go the moment
 * the reader scrolls for themselves.
 */
function useAnchoredSection(hash: string) {
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash);
    if (!target) return;

    const align = () => target.scrollIntoView();
    align();

    let timer = 0;
    const observer = new ResizeObserver(align);
    const release = () => {
      observer.disconnect();
      window.clearTimeout(timer);
      for (const event of HANDOVER_EVENTS) {
        window.removeEventListener(event, release);
      }
    };

    observer.observe(document.body);
    timer = window.setTimeout(release, 6000);
    for (const event of HANDOVER_EVENTS) {
      window.addEventListener(event, release, { passive: true });
    }

    return release;
  }, [hash]);
}

function LeaderboardsPage() {
  const { id } = Route.useParams();
  const { leaderboards } = Route.useLoaderData();
  const { data: competition } = useCompetition(id);
  const { hash } = useLocation();

  useAnchoredSection(hash);

  return (
    <>
      <CompetitionPageHeader
        competitionId={id}
        competitionName={competition?.name}
        title="Leaderboards"
        description="Public standings, rebuilt from every submission that has been scored."
        meta={
          leaderboards.length ? (
            <HeaderMeta>
              <span>
                <b>{leaderboards.length}</b>{" "}
                {leaderboards.length === 1 ? "board" : "boards"}
              </span>
            </HeaderMeta>
          ) : undefined
        }
        tabs
      />
      <PageBody>
        {!leaderboards.length ? (
          <Empty className="rounded-2xl border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>No leaderboards yet</EmptyTitle>
              <EmptyDescription>
                No leaderboards have been configured for this competition yet.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          // Every board on one page. A competition's boards are usually the
          // same standings cut different ways: a table, a podium, a chart.
          // Reading one against another used to cost a page load each, behind a
          // picker that presented them as alternatives. Stacked, comparing them
          // is scrolling.
          <div className="space-y-14">
            {leaderboards.map((leaderboard) => (
              <LeaderboardSection
                key={leaderboard.id}
                leaderboard={leaderboard}
              />
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}

function LeaderboardSection({
  leaderboard,
}: {
  leaderboard: LeaderboardSummary;
}) {
  const {
    data: def,
    isPending,
    isError,
    isFetching,
    refetch,
  } = useLoadedLeaderboard(leaderboard.id);

  // Resolve the renderer against *this* leaderboard, not the root config: a
  // board's own `with:` is applied last and so overrides the inherited default,
  // which is what lets one competition mix a table, cards, and a chart.
  const Leaderboard = useKitComponent("leaderboard.ui", {
    competitions: { leaderboards: leaderboard.id },
  });

  const headingId = `leaderboard-${leaderboard.id}`;

  return (
    // `scroll-mt` clears the sticky tab bar, so a link to one board lands with
    // its heading in view rather than under the chrome.
    <section
      id={leaderboard.id}
      aria-labelledby={headingId}
      className="scroll-mt-24"
    >
      <div className="mb-4">
        <h2 id={headingId} className="text-lg font-semibold tracking-tight">
          {leaderboard.name}
        </h2>
        {leaderboard.description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {leaderboard.description}
          </p>
        ) : null}
      </div>

      {/* No panel around the renderer. Each one draws its own surface: the
          grid is a bordered table, the podium a row of cards. Wrapping that in
          another card made a card inside a card. */}
      {isPending ? (
        <Skeleton
          className="h-72 w-full rounded-xl"
          role="status"
          aria-label={`Loading ${leaderboard.name}`}
        />
      ) : isError ? (
        <Empty className="rounded-xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlert />
            </EmptyMedia>
            <EmptyTitle>These standings didn't load</EmptyTitle>
            <EmptyDescription>
              The server didn't return this leaderboard. Try again, or reload
              the page.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? "Trying again..." : "Try again"}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Leaderboard def={def} />
      )}
    </section>
  );
}
