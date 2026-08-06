import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ActivityStats, QueryFailure } from "@/components/dashboard/parts";
import { ParticipantList } from "@/components/dashboard/participant-list";
import { PageBody } from "@/components/page-header-band";
import { useCompetitionActivity } from "@/lib/dashboard-fn";

export const Route = createFileRoute("/dashboard/$competitionId/participants/")({
  component: ParticipantsPage,
});

function ParticipantsPage() {
  const { competitionId } = Route.useParams();
  const { data: activity, isLoading, isError, error } = useCompetitionActivity(competitionId);

  return (
    <>
      <AdminPageHeader
        competitionId={competitionId}
        competitionName={activity?.name}
        title="Participants"
        description="Everybody who has entered a track in this competition."
        meta={<ActivityStats totals={activity?.totals} />}
        tabs
      />
      <PageBody>
        {isError ? (
          <QueryFailure error={error} />
        ) : (
          <ParticipantList
            competitionId={competitionId}
            participants={activity?.participants ?? []}
            tracks={activity?.tracks ?? []}
            isLoading={isLoading}
          />
        )}
      </PageBody>
    </>
  );
}
