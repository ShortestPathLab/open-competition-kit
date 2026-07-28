import { Panel, PanelBody, PanelHeader, PanelTitle } from "*/components/panel";
import { PageSkeleton } from "*/components/skeletons";
import { Stat, StatStrip } from "*/components/stat-strip";
import { Button } from "*/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "*/components/ui/empty";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Layers3, Lock } from "lucide-react";
import { authClient } from "src/lib/auth-client";
import { useUserEnrolments } from "src/lib/enrolment-fn";
import { useUserSubmissions } from "src/lib/submission-fn";

export const Route = createFileRoute("/me/")({
  component: MeIndexPage,
});

function MeIndexPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { data: enrolments = [], isLoading: enrolmentsLoading } =
    useUserEnrolments(session?.user?.id);
  const { data: submissions = [], isLoading: submissionsLoading } =
    useUserSubmissions(session?.user?.id);

  if (sessionLoading) return <PageSkeleton />;

  if (!session?.user) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Your competitions
          </h1>
          <p className="mt-1 text-muted-foreground">
            Sign in to track your enrolments, submissions, and progress across
            every competition.
          </p>
        </div>

        <Empty className="rounded-xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Lock />
            </EmptyMedia>
            <EmptyTitle>Sign in to view your dashboard</EmptyTitle>
            <EmptyDescription>
              Your competition activity is connected to your account.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link to="/sign-in" />}>Sign in</Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  if (enrolmentsLoading || submissionsLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <StatStrip>
        <Stat label="Enrolments" value={enrolments.length} />
        <Stat label="Submissions" value={submissions.length} />
      </StatStrip>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Enrolments</PanelTitle>
            <Button
              variant="outline"
              size="sm"
              render={<Link to="/me/enrolments" />}
            >
              See all
            </Button>
          </PanelHeader>
          <PanelBody>
            {enrolments.length === 0 ? (
              <Empty className="rounded-xl border border-dashed border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Layers3 />
                  </EmptyMedia>
                  <EmptyTitle>No enrolments yet</EmptyTitle>
                  <EmptyDescription>
                    Browse competitions to join your first track.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-3">
                {enrolments.slice(0, 4).map((enrolment) => (
                  <div
                    key={enrolment.id}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <p className="font-semibold">{enrolment.track.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {enrolment.competition.name}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {enrolment.track.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        render={
                          <Link
                            to="/competitions/$id/tracks/$trackId"
                            params={{
                              id: enrolment.competition.id,
                              trackId: enrolment.track.id,
                            }}
                          />
                        }
                      >
                        Open track
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        render={
                          <Link
                            to="/competitions/$id/submissions/new"
                            params={{ id: enrolment.competition.id }}
                            search={{ trackId: enrolment.track.id }}
                          />
                        }
                      >
                        Make submission
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Submissions</PanelTitle>
            <Button
              variant="outline"
              size="sm"
              render={<Link to="/me/submissions" />}
            >
              See all
            </Button>
          </PanelHeader>
          <PanelBody>
            {submissions.length === 0 ? (
              <Empty className="rounded-xl border border-dashed border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ClipboardList />
                  </EmptyMedia>
                  <EmptyTitle>No submissions yet</EmptyTitle>
                  <EmptyDescription>
                    Once you submit to a track, they will show up here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-3">
                {submissions.slice(0, 5).map((submission) => (
                  <Link
                    key={submission.id}
                    to="/me/submissions/$submissionId"
                    params={{ submissionId: submission.id }}
                    className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
                  >
                    <p className="font-semibold">{submission.trackName}</p>
                    <p className="text-sm text-muted-foreground">
                      {submission.competitionName}
                    </p>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                      {submission.id}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
