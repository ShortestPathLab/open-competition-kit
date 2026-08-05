import { TrackCard } from "@/components/track-card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { TrackSummary } from "@/lib/competition-data";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Layers3 } from "lucide-react";

/** How many fit above the fold without the section becoming the page. */
const PREVIEW_COUNT = 4;

export function TracksSection({
  competitionId,
  tracks,
}: {
  competitionId: string;
  tracks: TrackSummary[];
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Tracks</h2>
        <Button
          variant="link"
          size="sm"
          className="h-auto px-0"
          render={<Link to="/competitions/$id/tracks" params={{ id: competitionId }} />}
        >
          All tracks
          <ArrowRight />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Participation happens at the track level. Pick one to see its rules and standings.
      </p>
      {tracks.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {tracks.slice(0, PREVIEW_COUNT).map((track) => (
            <TrackCard
              key={track.id}
              id={track.id}
              competitionId={competitionId}
              name={track.name}
              description={track.description}
              icon={track.icon}
            />
          ))}
        </div>
      ) : (
        <Empty className="rounded-xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers3 />
            </EmptyMedia>
            <EmptyTitle>No tracks yet</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}
