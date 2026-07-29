import { CompetitionPageHeader } from "*/components/competition-page-header";
import { PageBody } from "*/components/page-header-band";
import { PageSkeleton } from "*/components/skeletons";
import { SubmissionCreator } from "*/components/submission-creator";
import { createFileRoute } from "@tanstack/react-router";
import { useCompetition } from "src/lib/competition-fn";
import { z } from "zod";

const submissionsNewSearch = z.object({
  trackId: z.string().optional(),
});

export const Route = createFileRoute("/competitions/$id/submissions/new")({
  validateSearch: submissionsNewSearch,
  component: CompetitionSubmissionCreatePage,
});

function CompetitionSubmissionCreatePage() {
  const { id } = Route.useParams();
  const { trackId } = Route.useSearch();
  const { data: competition } = useCompetition(id);

  if (!competition) return <PageSkeleton />;

  const track = competition.tracks.find(
    (candidate) => candidate.id === trackId,
  );

  return (
    <>
      {/* No tabs: this is a task, not a section. Naming the track in the
          breadcrumb is also the only place the form says which one it is
          before the picker inside it loads. */}
      <CompetitionPageHeader
        competitionId={id}
        competitionName={competition.name}
        trail={[{ label: "Submissions", section: "submissions" }]}
        title="New submission"
        description={
          track
            ? `Entering ${track.name}. Scoring runs on its own once you submit, and the result posts to the public leaderboard.`
            : "Scoring runs on its own once you submit, and the result posts to the public leaderboard."
        }
      />
      <PageBody>
        <SubmissionCreator competition={competition} initialTrackId={trackId} />
      </PageBody>
    </>
  );
}
