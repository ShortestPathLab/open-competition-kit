import { Button } from "*/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "*/components/ui/card";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  type CompetitionSummary,
  type TrackSummary,
} from "src/lib/competition-data";
import { useCompetition } from "src/lib/competition-fn";
import {
  type SubmissionBrowserItem as CompetitionSubmission,
  useCompetitionSubmissions,
} from "src/lib/submission-fn";
import { authClient } from "src/lib/auth-client";
import type { ReactNode } from "react";
import Markdown from "react-markdown";

export const Route = createFileRoute("/competitions/$id/")({
  component: CompetitionOverviewPage,
});

type OverviewStat = {
  label: string;
  value: string | number;
  valueClassName?: string;
};

function buildOverviewStats(competition: CompetitionSummary): OverviewStat[] {
  return [
    {
      label: "Organiser",
      value: competition.organiser,
      valueClassName: "text-sm font-medium text-foreground",
    },
    {
      label: "Competition ID",
      value: competition.id,
      valueClassName: "break-all font-mono text-sm text-foreground",
    },
    {
      label: "Tracks",
      value: competition.tracks.length,
      valueClassName: "font-semibold text-foreground",
    },
    {
      label: "Status",
      value: "Open for participation",
      valueClassName: "text-sm font-medium text-foreground",
    },
  ];
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <CardHeader className="border-b border-border/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {action}
      </div>
    </CardHeader>
  );
}

function OverviewStatCard({ label, value, valueClassName }: OverviewStat) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 backdrop-blur">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-2 ${valueClassName ?? "text-sm text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function DashedPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-border p-6 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

function FeaturedTrackCard({
  competitionId,
  track,
  index,
}: {
  competitionId: string;
  track: TrackSummary;
  index: number;
}) {
  return (
    <Link
      to="/competitions/$id/tracks/$trackId"
      params={{ id: competitionId, trackId: track.id }}
      className="group rounded-2xl border border-border/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,1))] p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Track {index + 1}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
      <h3 className="mt-6 text-lg font-semibold text-foreground">
        {track.name}
      </h3>
      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
        {track.description}
      </p>
    </Link>
  );
}

function SubmissionCard({ submission }: { submission: CompetitionSubmission }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-[linear-gradient(180deg,_rgba(255,255,255,1),_rgba(248,250,252,0.95))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {submission.trackName}
          </p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {submission.id}
          </p>
        </div>
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-4 line-clamp-4 break-all text-sm leading-6 text-foreground/90">
        {submission.body}
      </p>
      <div className="mt-4">
        <Button
          variant="outline"
          size="sm"
          render={
            <Link
              to="/competitions/$id/tracks/$trackId/submit"
              params={{
                id: submission.competitionId,
                trackId: submission.trackId,
              }}
            />
          }
        >
          Open track
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function CompetitionOverviewPage() {
  const { id } = Route.useParams();
  const { data: competition } = useCompetition(id);
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { data: mySubmissions = [], isLoading: submissionsLoading } =
    useCompetitionSubmissions(session?.user?.id, id);

  if (!competition) return <div>Loading...</div>;

  const featuredTracks = competition.tracks.slice(0, 3);
  const overviewStats = buildOverviewStats(competition);
  const browseTracksAction =
    session?.user && competition.tracks.length > 0 ? (
      <Button
        variant="outline"
        size="sm"
        render={
          <Link
            to="/competitions/$id/tracks/$trackId"
            params={{ id, trackId: competition.tracks[0]!.id }}
          />
        }
      >
        Browse tracks
        <ArrowRight className="h-4 w-4" />
      </Button>
    ) : undefined;

  return (
    <div className="space-y-6 py-2">
      <Card className="bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] shadow-sm">
        <CardContent className="px-6 py-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="text-xs font-medium">{competition.organiser}</div>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
                  {competition.name}
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  {competition.description}
                </p>
              </div>
            </div>
            <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
              {overviewStats.map((stat) => (
                <OverviewStatCard key={stat.label} {...stat} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Card className="shadow-sm">
          <SectionHeader
            title="Tracks"
            description="Start here and jump into the parts of the competition that are open right now."
            action={
              <Button
                variant="outline"
                size="sm"
                render={<Link to="/competitions/$id/tracks" params={{ id }} />}
              >
                See all
                <ArrowRight className="h-4 w-4" />
              </Button>
            }
          />
          <CardContent className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredTracks.length > 0 ? (
              featuredTracks.map((track, index) => (
                <FeaturedTrackCard
                  key={track.id}
                  competitionId={id}
                  track={track}
                  index={index}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                No tracks have been published yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <SectionHeader
            title="Leaderboards"
            description="Results and rankings will surface here once scoring is live."
            action={
              <Button
                variant="outline"
                size="sm"
                render={<Link to="/leaderboards" />}
              >
                See leaderboards
                <ArrowRight className="h-4 w-4" />
              </Button>
            }
          />
          <CardContent className="pt-4">
            <DashedPanel className="border-border/80 bg-muted/20 px-6 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                Leaderboards coming soon
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Once evaluation starts, this area will highlight top
                submissions, movement in the rankings, and standout tracks.
              </p>
            </DashedPanel>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <SectionHeader
          title="My submissions"
          description="Your recent work in this competition, grouped across enrolled tracks."
          action={browseTracksAction}
        />
        <CardContent className="pt-4">
          {sessionLoading ? (
            <DashedPanel className="text-sm text-muted-foreground">
              Loading your account details...
            </DashedPanel>
          ) : !session?.user ? (
            <DashedPanel className="sm:flex sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground">
                    Sign in to track your submissions
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Once you enrol in a track, your entries will appear here.
                  </p>
                </div>
                <Button render={<Link to="/sign-in" />}>Sign in</Button>
              </div>
            </DashedPanel>
          ) : submissionsLoading ? (
            <DashedPanel className="text-sm text-muted-foreground">
              Loading your submissions...
            </DashedPanel>
          ) : mySubmissions.length === 0 ? (
            <DashedPanel>
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-primary/10 p-3">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-foreground">
                    No submissions in this competition yet
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Enrol in a track and make your first submission to start
                    building your history here.
                  </p>
                </div>
              </div>
            </DashedPanel>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {mySubmissions
                .slice(0, 4)
                .map((submission: CompetitionSubmission) => (
                  <SubmissionCard key={submission.id} submission={submission} />
                ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="shadow-sm">
        <SectionHeader title="Details" />
        <CardContent className="prose max-w-none mt-4">
          <Markdown>{competition.overview}</Markdown>
        </CardContent>
      </Card>
    </div>
  );
}
