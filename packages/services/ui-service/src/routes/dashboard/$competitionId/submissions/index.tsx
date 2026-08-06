import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ActivityStats, QueryFailure } from "@/components/dashboard/parts";
import { SubmissionList } from "@/components/dashboard/submission-list";
import { PageBody } from "@/components/page-header-band";
import { useCompetitionActivity } from "@/lib/dashboard-fn";

export const Route = createFileRoute("/dashboard/$competitionId/submissions/")({
  component: AdminSubmissionsPage,
});

function AdminSubmissionsPage() {
  const { competitionId } = Route.useParams();
  const { data: activity, isLoading, isError, error } = useCompetitionActivity(competitionId);

  return (
    <>
      <AdminPageHeader
        competitionId={competitionId}
        competitionName={activity?.name}
        title="Submissions"
        description="Every entry across this competition's tracks, newest first."
        meta={<ActivityStats totals={activity?.totals} />}
        tabs
      />
      <PageBody>
        {isError ? (
          <QueryFailure error={error} />
        ) : (
          <SubmissionList
            competitionId={competitionId}
            rows={activity?.rows ?? []}
            tracks={activity?.tracks ?? []}
            isLoading={isLoading}
          />
        )}
      </PageBody>
    </>
  );
}
