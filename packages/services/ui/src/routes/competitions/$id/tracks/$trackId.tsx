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
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import sdk, { unsafe } from "sdk";
import { authClient } from "src/lib/auth-client";
import { getTrackSummary } from "src/lib/competition-data";
import { queryClient } from "src/router";
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

const enrolInTrack = createServerFn({ method: "POST" })
  .inputValidator(enrolmentInput)
  .handler(({ data }) =>
    unsafe(sdk.enrolments.enrol(data.userId, data.competitionId, data.trackId)),
  );

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

function TrackDetailsPage() {
  const { id: competitionId, trackId } = Route.useParams();
  const { data: session } = authClient.useSession();
  const fetchTrack = useServerFn(getTrack);
  const fetchEnrollmentStatus = useServerFn(getEnrollmentStatus);
  const enrolFn = useServerFn(enrolInTrack);

  const { data: track, isLoading: trackLoading } = useQuery({
    queryKey: ["track", competitionId, trackId],
    queryFn: () => (fetchTrack as any)({ data: { competitionId, trackId } }),
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

  const mutation = useMutation({
    mutationFn: () => {
      if (!session?.user?.id) throw new Error("No user id");
      return enrolFn({
        data: {
          userId: session.user.id,
          competitionId,
          trackId,
        },
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            "enrollmentStatus",
            session?.user?.id,
            competitionId,
            trackId,
          ],
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
              {isEnrolled && (
                <Button
                  variant="outline"
                  render={
                    <Link
                      to="/competitions/$id/tracks/$trackId/submit"
                      params={{ id: competitionId, trackId }}
                    />
                  }
                >
                  Make submission
                </Button>
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

      <Outlet />
    </div>
  );
}
