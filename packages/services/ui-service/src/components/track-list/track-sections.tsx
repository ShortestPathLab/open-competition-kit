import { TrackCard } from "@/components/track-card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { TrackList } from "@/lib/track-list-fn";
import { Layers3, SearchX } from "lucide-react";
import { TrackAction } from "./track-action";

type TrackSectionsProps = Pick<
  TrackList,
  "isLoading" | "trackCount" | "sections" | "isSignedIn"
> & { competitionId: string };

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-24 w-full rounded-xl"
          role="status"
          aria-label="Loading"
        />
      ))}
    </>
  );
}

function NoTracks() {
  return (
    <Empty className="rounded-2xl border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Layers3 />
        </EmptyMedia>
        <EmptyTitle>No tracks yet</EmptyTitle>
        <EmptyDescription>This competition doesn't have any tracks published yet.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function NoMatches() {
  return (
    <Empty className="rounded-2xl border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>No tracks match your filters</EmptyTitle>
        <EmptyDescription>Try a different keyword, or switch back to all tracks.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** The list itself: still loading, empty, filtered to nothing, or grouped. */
export function TrackSections({
  competitionId,
  isLoading,
  trackCount,
  sections,
  isSignedIn,
}: TrackSectionsProps) {
  const body = isLoading ? (
    <LoadingRows />
  ) : trackCount === 0 ? (
    <NoTracks />
  ) : sections.length === 0 ? (
    <NoMatches />
  ) : (
    sections.map((section) => (
      <section key={section.key} className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {section.label}
          <span className="font-mono tracking-normal">{section.rows.length}</span>
        </h2>
        {section.rows.map(({ track, phase, submissions }) => (
          <TrackCard
            key={track.id}
            id={track.id}
            competitionId={competitionId}
            name={track.name}
            description={track.description}
            icon={track.icon}
            reports={track.reports}
            submissions={submissions}
            showEnrolment={isSignedIn}
            dim={phase === "closed"}
            action={
              <TrackAction
                competitionId={competitionId}
                track={track}
                phase={phase}
                entered={submissions !== undefined}
              />
            }
          />
        ))}
      </section>
    ))
  );

  return <div className="mt-6 flex flex-col gap-6">{body}</div>;
}
