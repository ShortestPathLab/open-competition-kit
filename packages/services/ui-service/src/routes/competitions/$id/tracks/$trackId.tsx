import { CompetitionPageHeader } from "*/components/competition-page-header";
import { CompetitionIcon, TrackIcon } from "*/components/entity-icon";
import { NotFoundPage } from "*/components/not-found-page";
import { HeaderStats, PageBody } from "*/components/page-header-band";
import { PageSkeleton } from "*/components/skeletons";
import { Panel, PanelHeader, PanelTitle, PanelBody } from "*/components/panel";
import { Stat } from "*/components/stat-strip";
import { useNow } from "*/components/submission-window";
import { SurfaceSlot } from "*/components/surface-slot";
import { Button } from "*/components/ui/button";
import { Skeleton } from "*/components/ui/skeleton";
import { surface } from "@open-competition-kit/sdk/surface";
import { formatInstant } from "@open-competition-kit/sdk/instant";
import { nextInstant } from "@open-competition-kit/sdk/gate";
import { skipToken, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { authClient } from "src/lib/auth-client";
import { useCompetition } from "src/lib/competition-fn";
import { useTrackReports } from "src/lib/gate-fn";
import { getEnrollmentStatus } from "src/lib/enrolment-fn";
import { ensureTrack } from "src/lib/route-guards";
import {
  useTrack,
  useTrackEnrolmentCount,
  useTrackSubmissionCount,
} from "src/lib/track-fn";

export const Route = createFileRoute("/competitions/$id/tracks/$trackId")({
  // The competition layout above has already established that `id` is real and
  // put its track ids in context, so this costs nothing beyond the lookup.
  //
  // In the loader rather than in `beforeLoad`: a `notFound` thrown from
  // `beforeLoad` carries no route id, so the router hands it to the root
  // boundary and takes the whole app shell down with it. From the loader the
  // 404 stays scoped to this route, so a wrong track id leaves the navbar in
  // place to find a real one from.
  loader: ({ params, context }) =>
    ensureTrack(context.competition, params.trackId),
  component: TrackDetailsPage,
});

function TrackDetailsPage() {
  const { id: competitionId, trackId } = Route.useParams();
  const { data: session } = authClient.useSession();
  const { data: competition } = useCompetition(competitionId);
  const fetchEnrollmentStatus = useServerFn(getEnrollmentStatus);

  const { data: track, isLoading: trackLoading } = useTrack(trackId);
  const { data: submissionCount } = useTrackSubmissionCount(trackId);
  const { data: enrolmentCount } = useTrackEnrolmentCount(trackId);

  const { data: isEnrolled = false, isLoading: enrollmentLoading } = useQuery({
    queryKey: ["enrollmentStatus", session?.user?.id, trackId],
    queryFn: session?.user?.id
      ? () => fetchEnrollmentStatus({ data: { trackId } })
      : skipToken,
  });

  // Before the early returns: hooks cannot run conditionally, and `track` is
  // absent on the first render.
  const { reports } = useTrackReports(trackId, session?.user?.id);
  const now = useNow();

  if (trackLoading) return <PageSkeleton />;
  // The guard above rules out an unconfigured id, so reaching this means the
  // track went missing between the guard and the fetch.
  if (!track) return <NotFoundPage subject="track" />;

  const isSignedIn = Boolean(session?.user);

  // Whatever the gates are counting down to, as a single cell: the label carries
  // what happens and the value carries when, so an open track still says when it
  // stops being one. A track no gate has a date for gets no cell rather than an
  // empty one.
  //
  // A gate that is refusing names the cell even though its date has passed,
  // since "Closed 3 June" is the fact a reader arriving late wants. Otherwise it
  // is whatever comes next.
  const deciding =
    reports.find((report) => report.state === "blocked" && report.at) ??
    nextInstant(reports, now);

  const deadline =
    deciding?.at ?
      {
        label: deciding.atLabel ?? deciding.label,
        at: deciding.at,
        closed: deciding.state === "blocked",
      }
    : undefined;

  // One call to action, and it is whichever step the reader has not taken yet.
  // The second button only appears once they are in, because there is nothing to
  // look back at before that.
  const actions = !isSignedIn ? (
    <Button size="lg" className="h-10 px-5" render={<Link to="/sign-in" />}>
      Sign in to enrol
    </Button>
  ) : enrollmentLoading ? (
    // A placeholder rather than a guess. Showing "Enrol in this track" and
    // swapping it for "Make submission" once the answer arrives moves a button
    // that is already under somebody's cursor.
    <Skeleton className="h-10 w-44 rounded-lg" />
  ) : isEnrolled ? (
    <>
      <Button
        size="lg"
        className="h-10 px-5"
        render={
          <Link
            to="/competitions/$id/submissions/new"
            params={{ id: competitionId }}
            search={{ trackId }}
          />
        }
      >
        Make submission
        <ArrowRight />
      </Button>
      <Button
        size="lg"
        className="h-10 px-5"
        variant="outline"
        render={
          <Link
            to="/competitions/$id/submissions"
            params={{ id: competitionId }}
          />
        }
      >
        Your submissions
      </Button>
    </>
  ) : (
    <Button
      size="lg"
      className="h-10 px-5"
      render={
        <Link
          to="/competitions/$id/enrol"
          params={{ id: competitionId }}
          search={{ trackId }}
        />
      }
    >
      Enrol in this track
      <ArrowRight />
    </Button>
  );

  return (
    <>
      {/* No tabs. A track sits below the competition's sections rather than
          beside them, and the breadcrumb is what leads back out. The rest of the
          band matches the competition's own front page, because a track is the
          other thing on this site somebody enters and competes in. */}
      <CompetitionPageHeader
        competitionId={competitionId}
        competitionName={competition?.name}
        trail={[{ label: "Tracks", section: "tracks" }]}
        media={
          <TrackIcon
            competitionId={competitionId}
            trackId={trackId}
            icon={track.icon}
            className="hidden size-16 rounded-xl border border-border sm:block"
          />
        }
        title={track.name}
        description={
          <>
            {/* The competition gets a line of its own under the track's name.
                The breadcrumb says how you got here; this says what the track is
                part of, and it is worth a second glance on the way in. */}
            <Link
              to="/competitions/$id"
              params={{ id: competitionId }}
              className="flex w-fit items-center gap-2 font-medium text-foreground hover:text-primary"
            >
              {/* Held empty until the name arrives rather than seeded with a
                  placeholder, which would draw one avatar and then replace it
                  with a different one. */}
              {competition ?
                <CompetitionIcon
                  name={competition.name}
                  icon={competition.icon}
                  className="size-5 rounded"
                />
              : <span className="size-5 shrink-0 rounded bg-muted" />}
              {competition?.name}
            </Link>
            <span className="mt-1.5 block">{track.description}</span>
          </>
        }
        actions={actions}
        // What the track offers first, then what has happened in it, then where
        // the reader stands: the deadline is the only one of the four that
        // expires, and the last is the only one that is about them.
        meta={
          <HeaderStats>
            {deadline ? (
              <Stat
                label={deadline.label}
                value={
                  <span className="font-sans text-base">
                    {formatInstant(deadline.at)}
                  </span>
                }
                tone={deadline.closed ? "destructive" : undefined}
              />
            ) : null}
            <Stat label="Submissions" value={submissionCount ?? 0} />
            <Stat label="Enrolments" value={enrolmentCount ?? 0} />
            <Stat
              label="Your enrolment"
              value={
                !isSignedIn ? (
                  <span className="font-sans text-base">Not signed in</span>
                ) : enrollmentLoading ? (
                  <Skeleton className="h-7 w-28" />
                ) : (
                  <span className="font-sans text-base">
                    {isEnrolled ? "Enrolled" : "Not enrolled"}
                  </span>
                )
              }
              emphasis={isEnrolled}
            />
          </HeaderStats>
        }
      />
      <PageBody className="space-y-6">
        {/* Ahead of the rules: what a package set up for this track is part of
            getting ready for it, and that comes before the reading. */}
        <SurfaceSlot
          surface={surface.std.trackDetail}
          subject={{ competition: competitionId, track: trackId }}
          layout="inline"
        />

        <Panel>
          <PanelHeader>
            <PanelTitle>Rules</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <Markdown remarkPlugins={[remarkGfm]}>
                {track.rules ||
                  "No rules have been published for this track yet."}
              </Markdown>
            </div>
          </PanelBody>
        </Panel>
      </PageBody>
    </>
  );
}
