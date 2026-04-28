import { Button } from "*/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "*/components/ui/card";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardList, Layers3 } from "lucide-react";
import type { ReactNode } from "react";
import { authClient } from "src/lib/auth-client";
import { useUserEnrolments } from "src/lib/enrolment-fn";
import { useUserSubmissions } from "src/lib/submission-fn";

export const Route = createFileRoute("/me/")({
  component: MeIndexPage,
});

function OverviewStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 backdrop-blur">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function PreviewSectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <CardHeader className="border-b border-border/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {action}
      </div>
    </CardHeader>
  );
}

function MeIndexPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { data: enrolments = [], isLoading: enrolmentsLoading } =
    useUserEnrolments(session?.user?.id);
  const { data: submissions = [], isLoading: submissionsLoading } =
    useUserSubmissions(session?.user?.id);

  if (sessionLoading) return <div>Loading...</div>;

  if (!session?.user) {
    return (
      <div className="space-y-6">
        <Card className="bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] shadow-sm">
          <CardContent className="px-6 py-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <div className="text-xs font-medium">Account overview</div>
                <div className="space-y-3">
                  <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
                    Follow your competition work
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Sign in to see your enrolments, submissions, and progress
                    across every competition.
                  </p>
                </div>
              </div>
              <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
                <OverviewStat label="Enrolments" value={0} />
                <OverviewStat label="Submissions" value={0} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-2xl border border-dashed border-border p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                Sign in to view your dashboard
              </h2>
              <p className="text-sm text-muted-foreground">
                Your competition activity is connected to your account.
              </p>
            </div>
            <Button render={<Link to="/sign-in" />}>Sign in</Button>
          </div>
        </div>
      </div>
    );
  }

  if (enrolmentsLoading || submissionsLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <Card className="bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] shadow-sm">
        <CardContent className="px-6 py-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="text-xs font-medium">Account overview</div>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
                  Your competition dashboard
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Keep track of the competitions you have joined, revisit
                  tracks, and jump back into recent submissions.
                </p>
              </div>
            </div>
            <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
              <OverviewStat label="Enrolments" value={enrolments.length} />
              <OverviewStat label="Submissions" value={submissions.length} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="shadow-sm">
          <PreviewSectionHeader
            title="Enrolments"
            description="Tracks you are currently participating in."
            action={
              <Button
                variant="outline"
                size="sm"
                render={<Link to="/me/enrolments" />}
              >
                See all
                <ArrowRight className="h-4 w-4" />
              </Button>
            }
          />
          <CardContent className="space-y-3 ">
            {enrolments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                No enrolments yet. Browse competitions to join your first track.
              </div>
            ) : (
              enrolments.slice(0, 3).map((enrolment) => (
                <div
                  key={enrolment.id}
                  className="rounded-2xl border border-border/70 bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {enrolment.track.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {enrolment.competition.name}
                      </p>
                    </div>
                    <Layers3 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {enrolment.track.description}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
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
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <PreviewSectionHeader
            title="Submissions"
            description="Your most recent work across competitions."
            action={
              <Button
                variant="outline"
                size="sm"
                render={<Link to="/me/submissions" />}
              >
                See all
                <ArrowRight className="h-4 w-4" />
              </Button>
            }
          />
          <CardContent className="space-y-3 ">
            {submissions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                No submissions yet. Once you submit to a track, they will show
                up here.
              </div>
            ) : (
              submissions.slice(0, 4).map((submission) => (
                <Link
                  key={submission.id}
                  to="/me/submissions/$submissionId"
                  params={{ submissionId: submission.id }}
                  className="block rounded-2xl border border-border/70 bg-background p-4 hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {submission.trackName}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {submission.competitionName}
                      </p>
                    </div>
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-3 font-mono text-xs text-muted-foreground">
                    {submission.id}
                  </p>
                  <p className="mt-3 line-clamp-3 break-all text-sm text-foreground/90">
                    {submission.body}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
