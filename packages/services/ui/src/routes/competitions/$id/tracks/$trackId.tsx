import { EnrolmentCard } from "*/components/enrolment-card";
import { Loader } from "*/components/loader";
import { Button } from "*/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "*/components/ui/card";
import { skipToken, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import sdk from "sdk";
import { authClient } from "src/lib/auth-client";
import { getTrackSummary } from "src/lib/competition-data";
import { z } from "zod";

export const Route = createFileRoute("/competitions/$id/tracks/$trackId")({
  component: TrackDetailsPage,
});

const enrolmentInput = z.object({
  userId: z.string(),
  competitionId: z.string(),
  trackId: z.string(),
});

const trackInput = z.object({
  competitionId: z.string(),
  trackId: z.string(),
});

const getTrack = createServerFn({ method: "GET" })
  .inputValidator(trackInput)
  .handler(async ({ data }) => {
    return getTrackSummary(data.competitionId, data.trackId);
  });

const getEnrollmentStatus = createServerFn({ method: "GET" })
  .inputValidator(enrolmentInput)
  .handler(async ({ data }) => {
    const result = await sdk.enrolments.isEnrolled(
      data.userId,
      data.competitionId,
      data.trackId,
    );
    if (result.error) throw result.error;
    return result.value;
  });

function TrackMetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 break-all text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}

function TrackDetailsPage() {
  const { id: competitionId, trackId } = Route.useParams();
  const { data: session } = authClient.useSession();
  const fetchTrack = useServerFn(getTrack);
  const fetchEnrollmentStatus = useServerFn(getEnrollmentStatus);

  const { data: track, isLoading: trackLoading } = useQuery({
    queryKey: ["track", competitionId, trackId],
    queryFn: () => fetchTrack({ data: { competitionId, trackId } }),
  });

  const { data: isEnrolled = false, isLoading: enrollmentLoading } = useQuery({
    queryKey: ["enrollmentStatus", session?.user?.id, competitionId, trackId],
    queryFn: session?.user?.id
      ? () =>
          fetchEnrollmentStatus({
            data: { userId: session.user.id, competitionId, trackId },
          })
      : skipToken,
  });

  if (trackLoading) return <Loader className="p-6" />;
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

      <Card className="overflow-hidden rounded-lg border-border shadow-sm">
        <CardContent className="px-6 py-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="text-xs font-medium text-muted-foreground">
                Track
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
                  {track.name}
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  {track.description}
                </p>
              </div>
            </div>
            <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
              <TrackMetaCard label="Competition" value={competitionId} />
              <TrackMetaCard label="Track ID" value={track.id} />
              <TrackMetaCard
                label="Submissions"
                value="Available after enrolment"
              />
              <TrackMetaCard label="Status" value="Open for participation" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card key={track.id} className="shadow-sm">
        <CardHeader className="border-b border-border/60">
          <CardTitle>Rules</CardTitle>
          <CardDescription>{track.name}</CardDescription>
        </CardHeader>
        <CardContent className="prose max-w-none prose-sm">
          <Markdown remarkPlugins={[remarkGfm]}>{track.rules}</Markdown>
        </CardContent>
      </Card>
    </div>
  );
}
