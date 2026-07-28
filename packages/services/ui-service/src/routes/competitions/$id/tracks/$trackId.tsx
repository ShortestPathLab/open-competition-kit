import { EnrolmentCard } from "*/components/enrolment-card";
import { PageSkeleton } from "*/components/skeletons";
import { Panel, PanelHeader, PanelTitle, PanelBody } from "*/components/panel";
import { Button } from "*/components/ui/button";
import { skipToken, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { authClient } from "src/lib/auth-client";
import { getTrackSummary } from "src/lib/competition-data";
import { getEnrollmentStatus } from "src/lib/enrolment-fn";
import { z } from "zod";

export const Route = createFileRoute("/competitions/$id/tracks/$trackId")({
  component: TrackDetailsPage,
});

const trackInput = z.object({ trackId: z.string() });

const getTrack = createServerFn({ method: "GET" })
  .inputValidator(trackInput)
  .handler(async ({ data }) => {
    return getTrackSummary(data.trackId);
  });

function TrackDetailsPage() {
  const { id: competitionId, trackId } = Route.useParams();
  const { data: session } = authClient.useSession();
  const fetchTrack = useServerFn(getTrack);
  const fetchEnrollmentStatus = useServerFn(getEnrollmentStatus);

  const { data: track, isLoading: trackLoading } = useQuery({
    queryKey: ["track", trackId],
    queryFn: () => fetchTrack({ data: { trackId } }),
  });

  const { data: isEnrolled = false, isLoading: enrollmentLoading } = useQuery({
    queryKey: ["enrollmentStatus", session?.user?.id, trackId],
    queryFn:
      session?.user?.id ?
        () => fetchEnrollmentStatus({ data: { trackId } })
      : skipToken,
  });

  if (trackLoading) return <PageSkeleton />;
  if (!track) return <div>Track not found</div>;

  return (
    <div className="space-y-6">
      <Link
        to="/competitions/$id/tracks"
        params={{ id: competitionId }}
        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tracks
      </Link>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Track
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{track.name}</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          {track.description}
        </p>
      </div>
      <EnrolmentCard
        isSignedIn={Boolean(session?.user)}
        isLoading={enrollmentLoading}
        isEnrolled={isEnrolled}
        signInAction={<Button render={<Link to="/sign-in" />}>Sign in</Button>}
        enrolAction={
          <Button
            render={
              <Link
                to="/competitions/$id/enrol"
                params={{ id: competitionId }}
                search={{ trackId }}
              />
            }
          >
            Enrol in this track
          </Button>
        }
        submitAction={
          <Button
            variant="outline"
            render={
              <Link
                to="/competitions/$id/submissions/new"
                params={{ id: competitionId }}
                search={{ trackId }}
              />
            }
          >
            Make submission
          </Button>
        }
      />
      <Panel>
        <PanelHeader>
          <PanelTitle>Rules</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <Markdown remarkPlugins={[remarkGfm]}>
              {track.rules ||
                "No rules have been published for this track yet."}
            </Markdown>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
