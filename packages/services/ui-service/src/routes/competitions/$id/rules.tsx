import { createFileRoute } from "@tanstack/react-router";
import { Loader } from "*/components/loader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "*/components/ui/card";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCompetition } from "src/lib/competition-fn";

export const Route = createFileRoute("/competitions/$id/rules")({
  component: CompetitionRulesPage,
});

function CompetitionRulesPage() {
  const { id } = Route.useParams();
  const { data: competition } = useCompetition(id);

  if (!competition) return <Loader />;

  const tracksWithRules = competition.tracks.filter((track) => track.rules);

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="border-b border-border/60">
          <CardTitle>General Rules</CardTitle>
          <CardDescription>
            Rules that apply across the entire competition.
          </CardDescription>
        </CardHeader>
        <CardContent className="prose max-w-none prose-sm">
          <Markdown remarkPlugins={[remarkGfm]}>
            {competition.rules || "No rules have been published yet."}
          </Markdown>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {tracksWithRules?.map?.((track) => (
          <Card key={track.id} className="shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle>{track.name}</CardTitle>
              <CardDescription>{track.description}</CardDescription>
            </CardHeader>
            <CardContent className="prose max-w-none prose-sm">
              <Markdown remarkPlugins={[remarkGfm]}>{track.rules}</Markdown>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
