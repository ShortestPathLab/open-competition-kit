import { PageHeader } from "*/components/page-header";
import { Badge } from "*/components/ui/badge";
import { Button } from "*/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "*/components/ui/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import sdk from "sdk";
import { authClient } from "src/lib/auth-client";
import {
  getTrackSummary,
  isEnrolledInTrack,
} from "src/lib/competition-data";
import { queryClient } from "src/router";

export const Route = createFileRoute("/competitions/$id/tracks/$trackId")({
  component: TrackDetailsPage,
});

const enrolInTrack = createServerFn({ method: "POST" }).handler(
  async (ctx: any) => {
    const data = ctx.data as { userId: string; trackId: string };
    const result = await sdk.enrolments.enrol(data.userId, data.trackId);
    if (result.error) throw result.error;
    return { success: true, enrolment: result.value };
  },
);

const getTrack = createServerFn({ method: "GET" }).handler(async (ctx: any) => {
  const data = ctx.data as { competitionId: string; trackId: string };
  return getTrackSummary(data.competitionId, data.trackId);
});

const getEnrollmentStatus = createServerFn({ method: "GET" }).handler(
  async (ctx: any) => {
    const data = ctx.data as { userId: string; trackId: string };
    return isEnrolledInTrack(data.userId, data.trackId);
  },
);

function TrackDetailsPage() {
  const { id: competitionId, trackId } = Route.useParams();
  const { data: session } = authClient.useSession();
  const fetchTrack = useServerFn(getTrack);
  const fetchEnrollmentStatus = useServerFn(getEnrollmentStatus);
  const enrolFn = useServerFn(enrolInTrack);

  const { data: track, isLoading: trackLoading } = useQuery({
    queryKey: ["track", competitionId, trackId],
    queryFn: () =>
      (fetchTrack as any)({ data: { competitionId, trackId } }),
  });

  const { data: isEnrolled = false, isLoading: enrollmentLoading } = useQuery({
    queryKey: ["enrollmentStatus", session?.user?.id, trackId],
    queryFn: () =>
      (fetchEnrollmentStatus as any)({
        data: { userId: session?.user?.id, trackId },
      }),
    enabled: Boolean(session?.user?.id),
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (!session?.user?.id) throw new Error("No user id");
      return (enrolFn as any)({ data: { userId: session.user.id, trackId } });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["enrollmentStatus", session?.user?.id, trackId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myEnrolments", session?.user?.id],
        }),
      ]);
    },
  });

  if (trackLoading) return <div className="p-6">Loading...</div>;
  if (!track) return <div>Track not found</div>;

  return (
    <div className="space-y-6">
      <Link
        to="/competitions/$id/tracks"
        params={{ id: competitionId }}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tracks
      </Link>

      <PageHeader title={track.name} description={track.description} />

      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Enrolment</CardTitle>
              <CardDescription>
                Join this track to submit entries and follow your results.
              </CardDescription>
            </div>
            {session?.user && !enrollmentLoading && isEnrolled && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Enrolled
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {session?.user ? (
            <div className="flex flex-col items-start gap-3">
              <Button
                size="lg"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || isEnrolled || enrollmentLoading}
              >
                {mutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {isEnrolled ? "You are enrolled" : "Enrol in this track"}
              </Button>
              {mutation.isError && (
                <p className="text-sm font-medium text-destructive">
                  Enrolment failed. Please try again.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4 items-start">
              <p className="text-sm font-medium text-destructive">
                You must be signed in to enrol.
              </p>
              <Button render={<Link to="/sign-in" />}>Sign in</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
