import { CompetitionPageHeader } from "*/components/competition-page-header";
import { EnrolmentCard } from "*/components/enrolment-card";
import { NotFoundPage } from "*/components/not-found-page";
import { PageBody } from "*/components/page-header-band";
import { PageSkeleton } from "*/components/skeletons";
import { Panel, PanelHeader, PanelTitle, PanelBody } from "*/components/panel";
import {
  SubmissionWindowSummary,
  useWindowState,
} from "*/components/submission-window";
import { Button } from "*/components/ui/button";
import { skipToken, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { authClient } from "src/lib/auth-client";
import { useCompetition } from "src/lib/competition-fn";
import { getTrackSummary } from "src/lib/competition-data";
import { getEnrollmentStatus } from "src/lib/enrolment-fn";
import { ensureTrack } from "src/lib/route-guards";
import { z } from "zod";

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

const trackInput = z.object({ trackId: z.string() });

const getTrack = createServerFn({ method: "GET" })
  .inputValidator(trackInput)
  .handler(async ({ data }) => {
    return getTrackSummary(data.trackId);
  });

function TrackDetailsPage() {
  const { id: competitionId, trackId } = Route.useParams();
  const { data: session } = authClient.useSession();
  const { data: competition } = useCompetition(competitionId);
  const fetchTrack = useServerFn(getTrack);
  const fetchEnrollmentStatus = useServerFn(getEnrollmentStatus);

  const { data: track, isLoading: trackLoading } = useQuery({
    queryKey: ["track", trackId],
    queryFn: () => fetchTrack({ data: { trackId } }),
  });

  const { data: isEnrolled = false, isLoading: enrollmentLoading } = useQuery({
    queryKey: ["enrollmentStatus", session?.user?.id, trackId],
    queryFn: session?.user?.id
      ? () => fetchEnrollmentStatus({ data: { trackId } })
      : skipToken,
  });

  // Before the early returns: hooks cannot run conditionally, and `track` is
  // absent on the first render.
  const windowState = useWindowState(track ?? {});

  if (trackLoading) return <PageSkeleton />;
  // The guard above rules out an unconfigured id, so reaching this means the
  // track went missing between the guard and the fetch.
  if (!track) return <NotFoundPage subject="track" />;

  return (
    <>
      {/* No tabs. A track sits below the competition's sections rather than
          beside them, and the breadcrumb is what leads back out. */}
      <CompetitionPageHeader
        competitionId={competitionId}
        competitionName={competition?.name}
        trail={[{ label: "Tracks", section: "tracks" }]}
        title={track.name}
        description={track.description}
        // Checked here rather than left to the summary's own null: `meta` is an
        // element either way, so the band would reserve the row for a window
        // that does not exist.
        meta={
          track.opensAt || track.closesAt ? (
            <SubmissionWindowSummary window={track} state={windowState} />
          ) : undefined
        }
      />
      <PageBody className="space-y-6">
        <EnrolmentCard
          isSignedIn={Boolean(session?.user)}
          isLoading={enrollmentLoading}
          isEnrolled={isEnrolled}
          signInAction={
            <Button render={<Link to="/sign-in" />}>Sign in</Button>
          }
          enrolAction={
            <Button
              render={
                <Link
                  to="/competitions/$id/enrol"
                  params={{ id: competitionId }}
                  search={{ trackId }}
                />
              }
            >
              Enrol in this track
            </Button>
          }
          submitAction={
            <Button
              variant="outline"
              render={
                <Link
                  to="/competitions/$id/submissions/new"
                  params={{ id: competitionId }}
                  search={{ trackId }}
                />
              }
            >
              Make submission
            </Button>
          }
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
