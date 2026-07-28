import { ListSkeleton, PageSkeleton } from "*/components/skeletons";
import { Button } from "*/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "*/components/ui/empty";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "*/components/panel";
import { TrackCard } from "*/components/track-card";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardList, Layers3, Lock, Trophy } from "lucide-react";
import { useCompetition } from "src/lib/competition-fn";
import { useCompetitionLeaderboards } from "src/lib/leaderboard-fn";
import { useCompetitionSubmissions } from "src/lib/submission-fn";
import { authClient } from "src/lib/auth-client";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/competitions/$id/")({
  component: CompetitionOverviewPage,
});

function CompetitionOverviewPage() {
  const { id } = Route.useParams();
  const { data: competition } = useCompetition(id);
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { data: mySubmissions = [], isLoading: submissionsLoading } =
    useCompetitionSubmissions(session?.user?.id, id);
  const { data: leaderboards } = useCompetitionLeaderboards(id);

  if (!competition) return <PageSkeleton />;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:gap-8">
        <div className="space-y-8">
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Tracks</h2>
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0"
                render={<Link to="/competitions/$id/tracks" params={{ id }} />}
              >
                All tracks
                <ArrowRight />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Participation happens at the track level. Pick one to see its
              rules and standings.
            </p>
            {competition.tracks.length > 0 ?
              <div className="grid gap-3 sm:grid-cols-2">
                {competition.tracks.slice(0, 4).map((track) => (
                  <TrackCard
                    key={track.id}
                    id={track.id}
                    competitionId={id}
                    name={track.name}
                    description={track.description}
                  />
                ))}
              </div>
            : <Empty className="rounded-xl border border-dashed border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Layers3 />
                  </EmptyMedia>
                  <EmptyTitle>No tracks yet</EmptyTitle>
                </EmptyHeader>
              </Empty>
            }
          </section>

          <Panel>
            <PanelHeader>
              <PanelTitle>About this competition</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <div className="prose prose-sm max-w-none dark:prose-invert [&_h1]:mt-0 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-base">
                <Markdown remarkPlugins={[remarkGfm]}>
                  {competition.overview ||
                    "No overview has been published yet."}
                </Markdown>
              </div>
            </PanelBody>
          </Panel>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <Panel>
            <PanelHeader>
              <PanelTitle>Leaderboards</PanelTitle>
              {leaderboards?.length ?
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto px-0"
                  render={<Link to="/leaderboards" />}
                >
                  All
                </Button>
              : null}
            </PanelHeader>
            <PanelBody className="p-3">
              {leaderboards?.length ?
                <div className="flex flex-col">
                  {leaderboards.map((lb) => (
                    <Link
                      key={lb.id}
                      to="/leaderboards/$leaderboardId"
                      params={{ leaderboardId: lb.id }}
                      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {lb.name}
                        </span>
                        {lb.description ?
                          <span className="block truncate text-xs text-muted-foreground">
                            {lb.description}
                          </span>
                        : null}
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              : <Empty className="border border-dashed border-border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Trophy />
                    </EmptyMedia>
                    <EmptyTitle>No leaderboards yet</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              }
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Your submissions</PanelTitle>
            </PanelHeader>
            <PanelBody>
              {sessionLoading ?
                <ListSkeleton rows={2} />
              : !session?.user ?
                <Empty className="border border-dashed border-border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Lock />
                    </EmptyMedia>
                    <EmptyTitle>Sign in to track your submissions</EmptyTitle>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button render={<Link to="/sign-in" />}>Sign in</Button>
                  </EmptyContent>
                </Empty>
              : submissionsLoading ?
                <ListSkeleton rows={2} />
              : mySubmissions.length === 0 ?
                <Empty className="border border-dashed border-border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ClipboardList />
                    </EmptyMedia>
                    <EmptyTitle>No submissions yet</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              : <div className="space-y-4">
                  <ul className="divide-y divide-border">
                    {mySubmissions.slice(0, 5).map((submission) => (
                      <li
                        key={submission.id}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {submission.trackName}
                          </span>
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            {submission.id}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    render={
                      <Link
                        to="/competitions/$id/submissions/new"
                        params={{ id }}
                        search={{ trackId: mySubmissions[0].trackId }}
                      />
                    }
                  >
                    New submission
                  </Button>
                </div>
              }
            </PanelBody>
          </Panel>
        </aside>
    </div>
  );
}
