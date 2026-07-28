import { createFileRoute } from "@tanstack/react-router";
import { PageSkeleton } from "*/components/skeletons";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "*/components/panel";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCompetition } from "src/lib/competition-fn";

export const Route = createFileRoute("/competitions/$id/rules")({
  component: CompetitionRulesPage,
});

const proseClass =
  "prose prose-sm max-w-none dark:prose-invert [&_h1]:mt-0 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-base";

function CompetitionRulesPage() {
  const { id } = Route.useParams();
  const { data: competition } = useCompetition(id);

  if (!competition) return <PageSkeleton />;

  const tracksWithRules = competition.tracks.filter((track) => track.rules);

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader className="flex-col items-start gap-1">
          <PanelTitle>General rules</PanelTitle>
          <PanelDescription>
            Rules that apply across the entire competition.
          </PanelDescription>
        </PanelHeader>
        <PanelBody>
          <div className={proseClass}>
            <Markdown remarkPlugins={[remarkGfm]}>
              {competition.rules || "No rules have been published yet."}
            </Markdown>
          </div>
        </PanelBody>
      </Panel>

      {tracksWithRules.length > 0 ? (
        <div className="grid gap-6">
          {tracksWithRules.map((track) => (
            <Panel key={track.id}>
              <PanelHeader className="flex-col items-start gap-1">
                <PanelTitle>{track.name}</PanelTitle>
                <PanelDescription>{track.description}</PanelDescription>
              </PanelHeader>
              <PanelBody>
                <div className={proseClass}>
                  <Markdown remarkPlugins={[remarkGfm]}>{track.rules}</Markdown>
                </div>
              </PanelBody>
            </Panel>
          ))}
        </div>
      ) : null}
    </div>
  );
}
