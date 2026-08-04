import { AboutPanel } from "@/components/competition-overview/about-panel";
import { OverviewHeader } from "@/components/competition-overview/overview-header";
import { OverviewRail } from "@/components/competition-overview/overview-rail";
import { TracksSection } from "@/components/competition-overview/tracks-section";
import { PageBody } from "@/components/page-header-band";
import { PageSkeleton } from "@/components/skeletons";
import { SurfaceSlot } from "@/components/surface-slot";
import { useCompetitionOverview } from "@/lib/competition-overview-fn";
import { surface } from "@open-competition-kit/sdk/surface";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/competitions/$id/")({
  component: CompetitionOverviewPage,
});

function CompetitionOverviewPage() {
  const { id } = Route.useParams();
  const { competition, leaderboards, submissionCount, enrolmentCount, ...rail } =
    useCompetitionOverview(id);

  if (!competition) return <PageSkeleton />;

  return (
    <>
      <OverviewHeader
        competitionId={id}
        competition={competition}
        leaderboardCount={leaderboards?.length ?? 0}
        enrolmentCount={enrolmentCount ?? 0}
        submissionCount={submissionCount ?? 0}
      />

      <PageBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:gap-8">
          <div className="space-y-8">
            <TracksSection competitionId={id} tracks={competition.tracks} />

            <AboutPanel overview={competition.overview} />

            {/* After the organiser's own words. A package explains how the
                competition is wired; the overview explains what it is, and that
                should be read first. */}
            <SurfaceSlot
              surface={surface.std.competitionOverview}
              subject={{ competition: id }}
              layout="inline"
            />
          </div>

          <OverviewRail
            competitionId={id}
            leaderboards={leaderboards}
            {...rail}
          />
        </div>
      </PageBody>
    </>
  );
}
