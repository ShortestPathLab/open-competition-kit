import { createFileRoute } from "@tanstack/react-router";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCompetition } from "src/lib/competition-fn";

export const Route = createFileRoute("/competitions/$id/rules")({
  component: CompetitionRulesPage,
});

function CompetitionRulesPage() {
  const { id } = Route.useParams();
  const { data: competition } = useCompetition(id);

  if (!competition) return <div>Loading...</div>;

  return (
    <div className="prose">
      <Markdown remarkPlugins={[remarkGfm]}>
        {competition.rules || "No rules have been published yet."}
      </Markdown>
    </div>
  );
}
