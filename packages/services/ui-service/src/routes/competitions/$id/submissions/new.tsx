import { Loader } from "*/components/loader";
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

  if (!competition) return <Loader />;

  return (
    <SubmissionCreator competition={competition} initialTrackId={trackId} />
  );
}
