import { createFileRoute, Link } from "@tanstack/react-router";
import { surface } from "@open-competition-kit/sdk/surface";
import { ArrowUpRight, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ActivityChart, ScoreDistributionChart } from "@/components/dashboard/charts";
import { ActivityStats, QueryFailure } from "@/components/dashboard/parts";
import { SubmissionList } from "@/components/dashboard/submission-list";
import { PageBody } from "@/components/page-header-band";
import { SectionHeader } from "@/components/section-header";
import { SurfaceSlot } from "@/components/surface-slot";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useCompetitionActivity } from "@/lib/dashboard-fn";

export const Route = createFileRoute("/dashboard/$competitionId/overview/")({
  component: AdminOverviewPage,
});

/** How many recent submissions the overview shows before sending you to the list. */
const RECENT = 10;

function AdminOverviewPage() {
  const { competitionId } = Route.useParams();
  const { data: session } = authClient.useSession();
  const { data: activity, isLoading, isError, error } = useCompetitionActivity(competitionId);

  const rows = activity?.rows ?? [];
  const recent = rows.slice(0, RECENT);

  return (
    <>
      <AdminPageHeader
        competitionId={competitionId}
        competitionName={activity?.name}
        title={`Welcome back, ${session?.user?.name ?? "organiser"}`}
        description="How your competition is going right now."
        actions={
          <Button
            variant="outline"
            size="lg"
            className="h-10 px-5"
            render={<Link to="/competitions/$id" params={{ id: competitionId }} />}
          >
            View as a competitor
            <ArrowUpRight className="size-4" />
          </Button>
        }
        meta={<ActivityStats totals={activity?.totals} />}
        tabs
      />

      <PageBody className="flex flex-col gap-8">
        {/* One notice for the whole page rather than an empty state in each
            section. When the activity read fails, every section below it is
            empty for the same reason, and saying so four times says it worse. */}
        {isError ? <QueryFailure error={error} /> : null}

        {/* The organiser's side of the same arrangement the competitor pages
            make: where a package put the competition's things, so nobody has to
            read the config to find them. */}
        <SurfaceSlot
          surface={surface.std.dashboardOverview}
          subject={{ competition: competitionId }}
          layout="inline"
        />

        {/* Two questions the stat strip above cannot answer, because both are
            about shape rather than totals: when the work is arriving, and
            whether the scoring separates anybody. */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ActivityChart rows={rows} loading={isLoading} />
          <ScoreDistributionChart rows={rows} loading={isLoading} />
        </div>

        <section className="flex flex-col gap-4">
          <SectionHeader
            title="Latest submissions"
            description={
              rows.length > RECENT
                ? `The ${RECENT} most recent of ${rows.length}.`
                : "Everything entered so far, newest first."
            }
            actions={
              rows.length > RECENT ? (
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <Link
                      to="/dashboard/$competitionId/submissions"
                      params={{ competitionId }}
                    />
                  }
                >
                  See all
                </Button>
              ) : undefined
            }
          />
          <SubmissionList
            competitionId={competitionId}
            rows={recent}
            tracks={activity?.tracks ?? []}
            isLoading={isLoading}
          />
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader
            title="Who is competing"
            description="The people who have entered, ordered by who submitted most recently."
            actions={
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link to="/dashboard/$competitionId/participants" params={{ competitionId }} />
                }
              >
                <Users className="size-4" />
                All participants
              </Button>
            }
          />
          {/* Names only, and only a handful. The participants page is one click
              away and does the sorting, filtering and drilling in properly;
              repeating it here would be two lists to keep agreeing. */}
          <div className="flex flex-wrap gap-2">
            {(activity?.participants ?? []).slice(0, 12).map((participant) => (
              <Link
                key={participant.user}
                to="/dashboard/$competitionId/participants/$user"
                params={{ competitionId, user: participant.user }}
                className="rounded-full border border-border px-3 py-1 text-sm transition-colors hover:bg-muted"
              >
                {participant.userName}
                <span className="ml-1.5 font-mono text-xs text-muted-foreground tabular-nums">
                  {participant.submissions}
                </span>
              </Link>
            ))}
            {activity && activity.participants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nobody has entered a track yet.
              </p>
            ) : null}
            {activity && activity.participants.length > 12 ? (
              <span className="px-1 py-1 text-sm text-muted-foreground">
                and {activity.participants.length - 12} more
              </span>
            ) : null}
          </div>
        </section>
      </PageBody>
    </>
  );
}
