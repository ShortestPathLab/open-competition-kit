import { FormSkeleton } from "@/components/skeletons";
import { SurfaceSlot } from "@/components/surface-slot";
import type { CompetitionSummary } from "@/lib/competition-data";
import { surface } from "@open-competition-kit/sdk/surface";
import { FormPanel } from "./form-panel";
import { GateRefusals, NoTrackChosen, NoTracks } from "./notices";
import { ReadinessCard } from "./readiness-card";
import { RulesPanel } from "./rules-panel";
import { TrackPicker } from "./track-picker";
import { useSubmissionCreator } from "./use-submission-creator";

interface SubmissionCreatorProps {
  competition: CompetitionSummary;
  initialTrackId?: string;
}

export function SubmissionCreator({ competition, initialTrackId }: SubmissionCreatorProps) {
  const {
    tracks,
    trackId,
    selectTrack,
    selectedTrack,
    reports,
    isSignedIn,
    isEnrolled,
    enrollmentLoading,
    isEligible,
    gate,
    gateLoading,
    isOpen,
    ...form
  } = useSubmissionCreator(competition, initialTrackId);

  if (tracks.length === 0) return <NoTracks />;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      {/* No heading of its own. The page above already says this is a new
          submission, and two titles saying the same thing in different words
          read as two different things. */}
      <div className="space-y-6">
        <div className="space-y-5">
          <TrackPicker
            tracks={tracks}
            trackId={trackId}
            onSelect={selectTrack}
            selectedTrack={selectedTrack}
            reports={reports}
          />

          {!selectedTrack ? (
            <NoTrackChosen />
          ) : (
            <>
              <ReadinessCard
                competitionId={competition.id}
                track={selectedTrack}
                isSignedIn={isSignedIn}
                isLoading={enrollmentLoading}
                isEnrolled={isEnrolled}
              />

              {/* Above the form rather than beside it: how to prepare a
                  submission is worth reading before filling one in, and the rail
                  on the right belongs to the track's rules. */}
              <SurfaceSlot
                surface={surface.std.submissionNew}
                subject={{
                  competition: competition.id,
                  track: selectedTrack.id,
                }}
                layout="inline"
              />

              {isEligible && gateLoading ? <FormSkeleton fields={4} /> : null}

              {isEligible && gate && !gate.allowed ? <GateRefusals gate={gate} /> : null}

              {isEligible && isOpen ? <FormPanel {...form} trackName={selectedTrack.name} /> : null}
            </>
          )}
        </div>
      </div>

      <RulesPanel track={selectedTrack} />
    </div>
  );
}
