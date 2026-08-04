import { CompetitionPageHeader } from "@/components/competition-page-header";
import { EnrolledConfirmation } from "@/components/enrol/enrolled-confirmation";
import { NoTracks, SignInToEnrol } from "@/components/enrol/notices";
import { TrackChooser } from "@/components/enrol/track-chooser";
import { PageBody } from "@/components/page-header-band";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { PageSkeleton } from "@/components/skeletons";
import { useEnrolPage } from "@/lib/enrol-page-fn";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const enrolSearch = z.object({ trackId: z.string().optional() });

export const Route = createFileRoute("/competitions/$id/enrol")({
  validateSearch: enrolSearch,
  component: CompetitionEnrolPage,
});

function CompetitionEnrolPage() {
  const { id } = Route.useParams();
  const { trackId } = Route.useSearch();
  const { competition, selectedTrack, isSignedIn, mutation, enrolment, selectTrack } =
    useEnrolPage(id, trackId);

  if (!competition) return <PageSkeleton />;

  return (
    <>
      {/* No tabs, for the same reason the submission form has none: this is one
          step, and the breadcrumb is the way back out of it. */}
      <CompetitionPageHeader
        competitionId={id}
        competitionName={competition.name}
        trail={[{ label: "Tracks", section: "tracks" }]}
        title="Enrol in a track"
        crumb="Enrol"
        description="Pick the track you want to compete in, then confirm. You can enter more than one."
      />
      <PageBody className="space-y-6">
        <Panel>
          <PanelHeader className="flex-col items-start gap-1">
            <PanelTitle>Choose a track</PanelTitle>
            <PanelDescription>
              Participation happens at the track level for this competition.
            </PanelDescription>
          </PanelHeader>
          <PanelBody className="space-y-5">
            {!isSignedIn ?
              <SignInToEnrol />
            : competition.tracks.length === 0 ?
              <NoTracks />
            : enrolment && selectedTrack ?
              <EnrolledConfirmation
                competitionId={id}
                competitionName={competition.name}
                track={selectedTrack}
                enrolment={enrolment}
              />
            : <TrackChooser
                competitionId={id}
                tracks={competition.tracks}
                selectedTrack={selectedTrack}
                onSelect={selectTrack}
                mutation={mutation}
              />
            }
          </PanelBody>
        </Panel>
      </PageBody>
    </>
  );
}
