import { Button } from "*/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "*/components/ui/empty";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "*/components/panel";
import { ListSkeleton } from "*/components/skeletons";
import { SurfaceSlot } from "*/components/surface-slot";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock, Plus } from "lucide-react";
import BoringAvatar from "boring-avatars";
import { surface } from "@open-competition-kit/sdk/surface";
import type { CompetitionStandings } from "src/lib/leaderboard-fn";

function Box({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-secondary px-3 py-2.5">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[0.68rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/**
 * Where the reader stands in this competition: who they are, what they have
 * entered, and the one action left to take.
 *
 * Deliberately the only panel in the rail that speaks in the second person. The
 * deadline and the standings describe the competition and read the same for
 * everybody; this one is the reader's own row.
 */
export function YourCompetitionPanel({
  competitionId,
  isSignedIn,
  isLoading,
  name,
  enrolledTrackIds,
  submissionCount,
  standings,
}: {
  competitionId: string;
  isSignedIn: boolean;
  isLoading: boolean;
  name?: string;
  /** Tracks in *this* competition the reader has entered. */
  enrolledTrackIds: string[];
  submissionCount: number;
  standings?: CompetitionStandings | null;
}) {
  const body = () => {
    if (isLoading) return <ListSkeleton rows={2} />;

    if (!isSignedIn) {
      return (
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Lock />
            </EmptyMedia>
            <EmptyTitle>Sign in to take part</EmptyTitle>
            <EmptyDescription>
              Signing in tracks your submissions and your place on the board.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link to="/sign-in" />}>Sign in</Button>
          </EmptyContent>
        </Empty>
      );
    }

    const entered = enrolledTrackIds.length;
    // A rank exists whether or not they were pushed out of the top rows, so
    // both places have to be checked.
    const rank =
      standings?.top.find((entry) => entry.isYou)?.rank ?? standings?.you?.rank;

    return (
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-3">
          <span className="size-9 shrink-0 overflow-hidden rounded-full">
            <BoringAvatar
              name={name ?? "you"}
              variant="beam"
              className="h-full w-full"
            />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {name ?? "You"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {entered === 0 ?
                "not entered yet"
              : `entered ${entered} ${entered === 1 ? "track" : "tracks"}`}
            </span>
          </span>
        </div>

        {/* Best rank is dropped rather than dashed out when the competition has
            no ranked board to place them on, and the grid reflows to one box. */}
        <div className="grid grid-cols-2 gap-2 [&:has(>:only-child)]:grid-cols-1">
          <Box label="Submissions" value={submissionCount} />
          {standings ?
            <Box label="Best rank" value={rank ? `#${rank}` : "-"} />
          : null}
        </div>

        {entered > 0 ?
          <Button
            className="w-full"
            render={
              <Link
                to="/competitions/$id/submissions/new"
                params={{ id: competitionId }}
                search={{ trackId: enrolledTrackIds[0] }}
              />
            }
          >
            New submission
            <Plus />
          </Button>
        : <Button
            className="w-full"
            render={
              <Link
                to="/competitions/$id/tracks"
                params={{ id: competitionId }}
              />
            }
          >
            Enter a track
            <ArrowRight />
          </Button>
        }

        {/* Under the action, not above it: whatever an integration has to say
            here is about how the reader works on their entry, which only matters
            once they have decided to make one. */}
        <SurfaceSlot
          surface={surface.std.competitionYou}
          subject={{ competition: competitionId }}
          // The rule belongs to the caller rather than to the slot: it is what
          // separates the panel's own rows from a package's, and it draws only
          // because the slot renders nothing at all when no package contributed.
          className="border-t border-border pt-3.5"
        />
      </div>
    );
  };

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Your competition</PanelTitle>
      </PanelHeader>
      <PanelBody>{body()}</PanelBody>
    </Panel>
  );
}
