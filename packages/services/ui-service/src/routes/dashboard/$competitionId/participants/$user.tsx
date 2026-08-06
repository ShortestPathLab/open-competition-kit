import { createFileRoute } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { AdminPageHeader, type AdminParent } from "@/components/admin-page-header";
import { formatDay, formatWhen, QueryFailure } from "@/components/dashboard/parts";
import { SubmissionList } from "@/components/dashboard/submission-list";
import { HeaderStats, PageBody } from "@/components/page-header-band";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/panel";
import { PageSkeleton } from "@/components/skeletons";
import { Stat } from "@/components/stat-strip";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useParticipant } from "@/lib/dashboard-fn";

export const Route = createFileRoute("/dashboard/$competitionId/participants/$user")({
  component: ParticipantDetailPage,
});

const BACK: AdminParent = { label: "Participants", section: "participants" };

function ParticipantDetailPage() {
  const { competitionId, user } = Route.useParams();
  const { data: participant, isLoading, isError, error } = useParticipant(competitionId, user);

  if (isLoading) return <PageSkeleton />;

  if (isError || !participant) {
    return (
      <>
        <AdminPageHeader competitionId={competitionId} title="Participant" back={BACK} />
        <PageBody>
          {/* A read that failed says so. Reporting it as somebody who is not
              here would send an organiser looking for a person rather than for
              a broken server. */}
          {isError ? (
            <QueryFailure error={error} />
          ) : (
            <Empty className="rounded-2xl border border-dashed border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchX />
                </EmptyMedia>
                <EmptyTitle>Nobody here by that name</EmptyTitle>
                <EmptyDescription>
                  {/* The id belongs on this page and nowhere else: somebody
                      following a link that does not work needs to see what was
                      looked up. */}
                  No <code className="font-mono">{user}</code> has entered a track in this
                  competition.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </PageBody>
      </>
    );
  }

  const runs = participant.submissions.reduce((total, row) => total + row.runs, 0);
  const lastSubmittedAt = participant.submissions[0]?.submittedAt ?? null;

  return (
    <>
      <AdminPageHeader
        competitionId={competitionId}
        competitionName={participant.competitionName}
        title={participant.userName}
        back={BACK}
        description={
          participant.user === participant.userName ? undefined : (
            <span className="font-mono text-xs">{participant.user}</span>
          )
        }
        meta={
          <HeaderStats>
            <Stat label="Tracks entered" value={participant.tracks.length} />
            <Stat label="Submissions" value={participant.submissions.length} />
            <Stat label="Runs" value={runs} />
            <Stat
              label="Last submission (UTC)"
              value={
                <span className="font-sans text-base">
                  {formatWhen(lastSubmittedAt, "None yet")}
                </span>
              }
            />
          </HeaderStats>
        }
      />

      <PageBody className="flex flex-col gap-6">
        <Panel>
          <PanelHeader>
            <PanelTitle>Tracks</PanelTitle>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              Joined {formatDay(participant.joinedAt, "at an unknown time")}
            </span>
          </PanelHeader>
          {participant.tracks.length ? (
            <div className="divide-y divide-border">
              {participant.tracks.map((track) => (
                <div key={track.id} className="flex items-baseline justify-between gap-4 px-5 py-3">
                  <span className="text-sm font-medium">{track.name}</span>
                  <span className="text-sm text-muted-foreground">
                    Entered {formatDay(track.enrolledAt, "at an unknown time")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <PanelBody className="text-sm text-muted-foreground">
              {/* An enrolment row can outlive the track it names, and a
                  submission is enough to put somebody on the participants list,
                  so this state is reachable and worth explaining. */}
              This person has submitted here but holds no current enrolment. Their track may have
              been removed from the config.
            </PanelBody>
          )}
        </Panel>

        <SubmissionList
          competitionId={competitionId}
          rows={participant.submissions}
          tracks={participant.tracks}
          isLoading={false}
          emptyTitle="No submissions yet"
          emptyDescription="This person has entered a track but has not submitted anything to it."
        />
      </PageBody>
    </>
  );
}
