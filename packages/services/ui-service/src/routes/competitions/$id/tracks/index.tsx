import { CompetitionPageHeader } from "@/components/competition-page-header";
import { HeaderStats, PageBody } from "@/components/page-header-band";
import { Stat } from "@/components/stat-strip";
import { TrackFilters } from "@/components/track-list/track-filters";
import { TrackSections } from "@/components/track-list/track-sections";
import { useTrackList } from "@/lib/track-list-fn";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/competitions/$id/tracks/")({
  component: TracksPage,
});

function TracksPage() {
  const { id } = Route.useParams();
  const list = useTrackList(id);
  const { competition, trackCount, openCount, enteredCount, nextDeadline } =
    list;

  return (
    <>
      <CompetitionPageHeader
        competitionId={id}
        competitionName={competition?.name}
        title="Tracks"
        description="Participation happens at the track level. Each one has its own window, its own rules, and its own leaderboard."
        meta={
          <HeaderStats>
            <Stat label="Tracks" value={trackCount} />
            {trackCount > 0 ? <Stat label="Open now" value={openCount} /> : null}
            {enteredCount > 0 ? (
              <Stat label="You have entered" value={enteredCount} emphasis />
            ) : null}
            {nextDeadline ? (
              <Stat
                label="Next deadline"
                value={<span className="font-sans text-lg">{nextDeadline}</span>}
              />
            ) : null}
          </HeaderStats>
        }
        tabs
      />
      <PageBody>
        <TrackFilters {...list} />
        <TrackSections competitionId={id} {...list} />
      </PageBody>
    </>
  );
}
