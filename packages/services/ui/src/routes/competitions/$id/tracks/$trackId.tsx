import { EnrolmentCard } from "*/components/enrolment-card";
import { PageHeader } from "*/components/page-header";
import { Button } from "*/components/ui/button";
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
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

      <EnrolmentCard
        isSignedIn={Boolean(session?.user)}
        isLoading={enrollmentLoading}
        isEnrolled={isEnrolled}
        isPending={mutation.isPending}
        isError={mutation.isError}
        onEnrol={() => mutation.mutate()}
        signInAction={<Button render={<Link to="/sign-in" />}>Sign in</Button>}
        submitAction={
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
        }
      />

      <Outlet />
    </div>
  );
}
