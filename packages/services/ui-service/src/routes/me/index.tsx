import { MePageHeader } from "*/components/me-page-header";
import { HeaderStats, PageBody } from "*/components/page-header-band";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "*/components/panel";
import { ListSkeleton } from "*/components/skeletons";
import { Stat } from "*/components/stat-strip";
import { phaseOf } from "*/components/submission-window";
import { SurfaceSlot } from "*/components/surface-slot";
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
import { surface } from "@open-competition-kit/sdk/surface";
import { windowStateAt } from "@open-competition-kit/sdk/window";
import { ArrowRight, ClipboardList, Layers3, Lock } from "lucide-react";
import { useMemo } from "react";
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

  const signedIn = Boolean(session?.user);
  const loading =
    sessionLoading || (signedIn && (enrolmentsLoading || submissionsLoading));

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      competitions: new Set(
        enrolments.map((enrolment) => enrolment.competition.id),
      ).size,
      tracks: enrolments.length,
      submissions: submissions.length,
      closing: enrolments.filter(
        (enrolment) =>
          phaseOf(
            enrolment.track,
            windowStateAt(enrolment.track, now),
            now,
          ) === "closing",
      ).length,
    };
  }, [enrolments, submissions]);

  return (
    <>
      <MePageHeader
        // The area is named in the breadcrumb, so the title names the page, the
        // way every section under it does. Titling this one "Your competitions"
        // as well made the two lines say the same thing twice, and it left the
        // breadcrumb stopping a step short of every sibling's.
        title="Overview"
        description="Everything you have entered, in one place."
        actions={
          <Button
            size="lg"
            className="h-10 px-5"
            render={<Link to="/competitions" />}
          >
            Browse competitions
            <ArrowRight />
          </Button>
        }
        // Only once there is a signed-in reader for these to be about. Signed
        // out, a strip of zeroes reads as an empty account rather than as a
        // prompt to sign in.
        meta={
          signedIn && !loading ?
            <HeaderStats>
              <Stat label="Competitions" value={stats.competitions} />
              <Stat label="Enrolled tracks" value={stats.tracks} />
              <Stat label="Submissions" value={stats.submissions} />
              <Stat
                label="Closing soon"
                value={stats.closing}
                emphasis={stats.closing > 0}
              />
            </HeaderStats>
          : undefined
        }
        tabs
      />

      <PageBody className="space-y-6">
        {/* Above the two lists, and only for a signed-in reader: an account-wide
            note from a package is about the reader, and the lists below are only
            the parts of that the product happens to know about. */}
        {signedIn && !loading ?
          <SurfaceSlot surface={surface.std.meOverview} subject={{}} layout="inline" />
        : null}

        {loading ?
          <ListSkeleton aria-label="Loading your competitions..." />
        : !signedIn ?
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
              <Button
                size="lg"
                className="h-10 px-5"
                render={<Link to="/sign-in" />}
              >
                Sign in
              </Button>
            </EmptyContent>
          </Empty>
        : <div className="grid gap-6 xl:grid-cols-2">
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
                {enrolments.length === 0 ?
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
                : <div className="space-y-3">
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
                }
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
                {submissions.length === 0 ?
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
                : <div className="space-y-3">
                    {[...submissions]
                      .reverse()
                      .slice(0, 5)
                      .map((submission) => (
                        <Link
                          key={submission.id}
                          to="/me/submissions/$submissionId"
                          params={{ submissionId: submission.id }}
                          className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
                        >
                          <p className="font-semibold">
                            {submission.trackName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {submission.competitionName}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Submission {submission.number}
                          </p>
                        </Link>
                      ))}
                  </div>
                }
              </PanelBody>
            </Panel>
          </div>
        }
      </PageBody>
    </>
  );
}
