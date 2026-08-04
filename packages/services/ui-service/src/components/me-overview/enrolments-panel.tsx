import { Button } from "@/components/ui/button";
import type { EnrolmentSummary } from "@/lib/competition-data";
import { Link } from "@tanstack/react-router";
import { Layers3 } from "lucide-react";
import { PanelEmpty, PreviewPanel } from "./preview-panel";

/** How many fit beside the submissions panel without either one scrolling. */
const PREVIEW_COUNT = 4;

function EnrolmentRow({ enrolment }: { enrolment: EnrolmentSummary }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="font-semibold">{enrolment.track.name}</p>
      <p className="text-sm text-muted-foreground">
        {enrolment.competition.name}
      </p>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
        {enrolment.track.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          render={
            <Link
              to="/competitions/$id/tracks/$trackId"
              params={{
                id: enrolment.competition.id,
                trackId: enrolment.track.id,
              }}
            />
          }
        >
          Open track
        </Button>
        <Button
          variant="outline"
          size="sm"
          render={
            <Link
              to="/competitions/$id/submissions/new"
              params={{ id: enrolment.competition.id }}
              search={{ trackId: enrolment.track.id }}
            />
          }
        >
          Make submission
        </Button>
      </div>
    </div>
  );
}

export function EnrolmentsPanel({
  enrolments,
}: {
  enrolments: EnrolmentSummary[];
}) {
  return (
    <PreviewPanel
      title="Enrolments"
      seeAll={
        <Button variant="outline" size="sm" render={<Link to="/me/enrolments" />}>
          See all
        </Button>
      }
    >
      {enrolments.length === 0 ?
        <PanelEmpty
          icon={<Layers3 />}
          title="No enrolments yet"
          description="Browse competitions to join your first track."
        />
      : <div className="space-y-3">
          {enrolments.slice(0, PREVIEW_COUNT).map((enrolment) => (
            <EnrolmentRow key={enrolment.id} enrolment={enrolment} />
          ))}
        </div>
      }
    </PreviewPanel>
  );
}
