import { CompetitionPageHeader } from "@/components/competition-page-header";
import { TrackIcon } from "@/components/entity-icon";
import { MarkdownPanel } from "@/components/markdown-panel";
import { NotFoundPage } from "@/components/not-found-page";
import { PageBody } from "@/components/page-header-band";
import { PageSkeleton } from "@/components/skeletons";
import { SurfaceSlot } from "@/components/surface-slot";
import { TrackActions } from "@/components/track-detail/track-actions";
import { TrackDescription } from "@/components/track-detail/track-description";
import { TrackStats } from "@/components/track-detail/track-stats";
import { ensureTrack } from "@/lib/route-guards";
import { useTrackDetail } from "@/lib/track-detail-fn";
import { surface } from "@open-competition-kit/sdk/surface";
import { createFileRoute } from "@tanstack/react-router";

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
  const {
    competition,
    track,
    trackLoading,
    isSignedIn,
    isEnrolled,
    enrollmentLoading,
    ...stats
  } = useTrackDetail(competitionId, trackId);

  if (trackLoading) return <PageSkeleton />;
  // The guard above rules out an unconfigured id, so reaching this means the
  // track went missing between the guard and the fetch.
  if (!track) return <NotFoundPage subject="track" />;

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
          <TrackDescription
            competitionId={competitionId}
            competition={competition}
            description={track.description}
          />
        }
        actions={
          <TrackActions
            competitionId={competitionId}
            trackId={trackId}
            isSignedIn={isSignedIn}
            isLoading={enrollmentLoading}
            isEnrolled={isEnrolled}
          />
        }
        meta={
          <TrackStats
            isSignedIn={isSignedIn}
            isEnrolled={isEnrolled}
            enrollmentLoading={enrollmentLoading}
            {...stats}
          />
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

        <MarkdownPanel
          title="Rules"
          markdown={track.rules}
          fallback="No rules have been published for this track yet."
        />
      </PageBody>
    </>
  );
}
