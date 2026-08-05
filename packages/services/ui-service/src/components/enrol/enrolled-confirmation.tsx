import { SurfaceSlot } from "@/components/surface-slot";
import { Button } from "@/components/ui/button";
import type { TrackSummary } from "@/lib/competition-data";
import type { EnrolPage } from "@/lib/enrol-page-fn";
import { surface } from "@open-competition-kit/sdk/surface";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CircleCheck } from "lucide-react";

/** What just happened, and the two places worth going next. */
export function EnrolledConfirmation({
  competitionId,
  competitionName,
  track,
  enrolment,
}: {
  competitionId: string;
  competitionName: string;
  track: TrackSummary;
  enrolment: EnrolPage["enrolment"];
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" />
        <div>
          <p className="text-sm font-semibold text-success">You are entered in {track.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {competitionName} will count your submissions to this track from now on.
          </p>
        </div>
      </div>

      {/* Whatever else enrolling set up. A package that created something on the
          reader's behalf gets to say so here, while it is still the thing that
          just happened. */}
      <SurfaceSlot
        surface={surface.std.enrolmentDone}
        subject={{
          competition: competitionId,
          track: track.id,
          enrolment,
        }}
        layout="inline"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          render={
            <Link
              to="/competitions/$id/submissions/new"
              params={{ id: competitionId }}
              search={{ trackId: track.id }}
            />
          }
        >
          Make a submission
          <ArrowRight />
        </Button>
        <Button
          variant="outline"
          render={
            <Link
              to="/competitions/$id/tracks/$trackId"
              params={{ id: competitionId, trackId: track.id }}
            />
          }
        >
          Open track
        </Button>
      </div>
    </div>
  );
}
