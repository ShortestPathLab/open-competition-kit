import { CompetitionPageHeader } from "*/components/competition-page-header";
import { PageSkeleton } from "*/components/skeletons";
import { Button } from "*/components/ui/button";
import { Badge } from "*/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "*/components/ui/empty";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "*/components/ui/popover";
import { DeadlinePanel } from "*/components/deadline-panel";
import { HeaderStats, PageBody } from "*/components/page-header-band";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "*/components/panel";
import { StandingsPanel } from "*/components/standings-panel";
import { Stat } from "*/components/stat-strip";
import { SurfaceSlot } from "*/components/surface-slot";
import { TrackCard } from "*/components/track-card";
import { YourCompetitionPanel } from "*/components/your-competition-panel";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { surface } from "@open-competition-kit/sdk/surface";
import { isDraft } from "@open-competition-kit/sdk/visibility";
import {
  ArrowRight,
  ChevronRight,
  Layers3,
  PencilRuler,
  Trophy,
} from "lucide-react";
import BoringAvatar from "boring-avatars";
import { useState } from "react";
import {
  useCompetition,
  useCompetitionEnrolmentCount,
  useCompetitionSubmissionCount,
} from "src/lib/competition-fn";
import {
  useCompetitionLeaderboards,
  useCompetitionStandings,
} from "src/lib/leaderboard-fn";
import { useUserEnrolments } from "src/lib/enrolment-fn";
import { useCompetitionSubmissions } from "src/lib/submission-fn";
import { authClient } from "src/lib/auth-client";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/competitions/$id/")({
  component: CompetitionOverviewPage,
});

function CompetitionOverviewPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const [trackPickerOpen, setTrackPickerOpen] = useState(false);

  const { data: competition } = useCompetition(id);
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const userId = session?.user?.id;

  const { data: mySubmissions = [], isLoading: submissionsLoading } =
    useCompetitionSubmissions(userId, id);
  const { data: myEnrolments = [], isLoading: enrolmentsLoading } =
    useUserEnrolments(userId);
  const { data: leaderboards } = useCompetitionLeaderboards(id);
  const { data: submissionCount } = useCompetitionSubmissionCount(id);
  const { data: enrolmentCount } = useCompetitionEnrolmentCount(id);
  const { data: standings, isPending: standingsLoading } =
    useCompetitionStandings(id, userId);

  if (!competition) return <PageSkeleton />;

  const enrolledTrackIds = myEnrolments
    .filter((enrolment) => enrolment.competition.id === id)
    .map((enrolment) => enrolment.track.id);

  return (
    <>
      {/* The one page whose subject is the competition itself, so it keeps the
          full hero: the title is the competition's name rather than the page's.
          The breadcrumb still ends on "Overview", so this page names itself
          there the way each of its siblings does. */}
      <CompetitionPageHeader
        className="[view-transition-name:competition-header]"
        competitionId={id}
        competitionName={competition.name}
        crumb="Overview"
        media={
          <div className="hidden size-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted sm:block">
            <BoringAvatar
              name={competition.name}
              square
              preserveAspectRatio="none"
              className="h-full w-full"
            />
          </div>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {competition.name}
            {/* Only an organiser is ever handed a draft, so this doubles as a
                reminder that nobody else can reach this page. */}
            {isDraft(competition) ? (
              <Badge variant="secondary">
                <PencilRuler />
                Draft, visible only to organisers
              </Badge>
            ) : null}
          </span>
        }
        description={
          <>
            <span className="block text-foreground">
              {competition.organiser}
            </span>
            <span className="mt-1.5 block">{competition.description}</span>
          </>
        }
        actions={
          <>
            <Popover open={trackPickerOpen} onOpenChange={setTrackPickerOpen}>
              <PopoverTrigger
                render={<Button size="lg" className="h-10 px-5" />}
              >
                Enter a track
                <ArrowRight />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96 p-3">
                <PopoverHeader className="px-1">
                  <PopoverTitle>Choose a track</PopoverTitle>
                  <PopoverDescription>
                    Participation happens at the track level.
                  </PopoverDescription>
                </PopoverHeader>
                <div className="flex flex-col gap-1">
                  {competition.tracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => {
                        setTrackPickerOpen(false);
                        router.navigate({
                          to: "/competitions/$id/tracks/$trackId",
                          params: { id, trackId: track.id },
                        });
                      }}
                      className="flex min-h-16 w-full items-start justify-between gap-3 rounded-md border border-border/40 px-3 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">{track.name}</span>
                        <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                          {track.description}
                        </span>
                      </span>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button
              size="lg"
              className="h-10 px-5"
              variant="outline"
              render={<Link to="/competitions/$id/rules" params={{ id }} />}
            >
              Read the rules
            </Button>
          </>
        }
        // Panels rather than the inline meta row the section pages use. This is
        // the competition's front page, and these are the three numbers that
        // describe it, so they get the room to be read at a glance.
        meta={
          <HeaderStats>
            {/* What the competition offers first, then what has happened in it,
                in the order it happens: you enter, then you submit. */}
            <Stat label="Tracks" value={competition.tracks.length} />
            <Stat label="Leaderboards" value={leaderboards?.length ?? 0} />
            <Stat label="Enrolments" value={enrolmentCount ?? 0} />
            <Stat label="Submissions" value={submissionCount ?? 0} />
          </HeaderStats>
        }
        tabs
      />

      <PageBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:gap-8">
          <div className="space-y-8">
            <section className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight">Tracks</h2>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto px-0"
                  render={
                    <Link to="/competitions/$id/tracks" params={{ id }} />
                  }
                >
                  All tracks
                  <ArrowRight />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Participation happens at the track level. Pick one to see its
                rules and standings.
              </p>
              {competition.tracks.length > 0 ? (
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
              ) : (
                <Empty className="rounded-xl border border-dashed border-border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Layers3 />
                    </EmptyMedia>
                    <EmptyTitle>No tracks yet</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              )}
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

            {/* After the organiser's own words. A package explains how the
                competition is wired; the overview explains what it is, and that
                should be read first. */}
            <SurfaceSlot
              surface={surface.std.competitionOverview}
              subject={{ competition: id }}
              layout="inline"
            />
          </div>

          {/* Rail order is deadline, then standings, then you. It runs from what
            is true of the competition to what is true of the reader, and the
            deadline goes first because it is the only one that expires. */}
          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            <DeadlinePanel tracks={competition.tracks} />

            <StandingsPanel
              competitionId={id}
              standings={standings}
              isLoading={standingsLoading}
            />

            <YourCompetitionPanel
              competitionId={id}
              isSignedIn={!!session?.user}
              isLoading={
                sessionLoading ||
                (!!userId && (submissionsLoading || enrolmentsLoading))
              }
              name={session?.user?.name}
              enrolledTrackIds={enrolledTrackIds}
              submissionCount={mySubmissions.length}
              standings={standings}
            />

            <Panel>
              <PanelHeader>
                <PanelTitle>Leaderboards</PanelTitle>
                {leaderboards?.length ? (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto px-0"
                    render={
                      <Link
                        to="/competitions/$id/leaderboards"
                        params={{ id }}
                      />
                    }
                  >
                    All
                  </Button>
                ) : null}
              </PanelHeader>
              <PanelBody className="p-3">
                {leaderboards?.length ? (
                  <div className="flex flex-col">
                    {leaderboards.map((lb) => (
                      <Link
                        key={lb.id}
                        to="/competitions/$id/leaderboards"
                        params={{ id }}
                        hash={lb.id}
                        className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {lb.name}
                          </span>
                          {lb.description ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {lb.description}
                            </span>
                          ) : null}
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Empty className="border border-dashed border-border">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Trophy />
                      </EmptyMedia>
                      <EmptyTitle>No leaderboards yet</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                )}
              </PanelBody>
            </Panel>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
