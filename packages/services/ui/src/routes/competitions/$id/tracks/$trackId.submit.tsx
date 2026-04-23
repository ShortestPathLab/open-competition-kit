import { Button } from "*/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "*/components/ui/card";
import { Input } from "*/components/ui/input";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import sdk from "sdk";
import { authClient } from "src/lib/auth-client";
import { ensureSession } from "src/lib/auth.server";
import { isEnrolledInTrack } from "src/lib/competition-data";
import { queryClient } from "src/router";

export const Route = createFileRoute("/competitions/$id/tracks/$trackId/submit")(
  {
    component: TrackSubmissionPage,
  },
);

const getEnrollmentStatus = createServerFn({ method: "GET" }).handler(
  async (ctx: any) => {
    const data = ctx.data as { userId: string; trackId: string };
    return isEnrolledInTrack(data.userId, data.trackId);
  },
);

const createSubmission = createServerFn({ method: "POST" }).handler(
  async (ctx: any) => {
    const data = ctx.data as { trackId: string; value: string };
    const session = await ensureSession();
    const enrolments = await sdk.enrolments.list({
      user: session.user.id,
      track: data.trackId,
    });

    if (!enrolments.value?.length) {
      throw new Error("You must enrol in this track before submitting.");
    }

    const result = await sdk.submissions.create({
      user: session.user.id,
      track: data.trackId,
      body: JSON.stringify({ value: data.value }),
    });

    if (result.error) throw result.error;

    return { success: true, submission: result.value };
  },
);

function TrackSubmissionPage() {
  const { trackId } = Route.useParams();
  const { data: session } = authClient.useSession();
  const [value, setValue] = useState("");
  const fetchEnrollmentStatus = useServerFn(getEnrollmentStatus);
  const submitFn = useServerFn(createSubmission);

  const { data: isEnrolled = false } = useQuery({
    queryKey: ["enrollmentStatus", session?.user?.id, trackId],
    queryFn: () =>
      (fetchEnrollmentStatus as any)({
        data: { userId: session?.user?.id, trackId },
      }),
    enabled: Boolean(session?.user?.id),
  });

  const mutation = useMutation({
    mutationFn: () => (submitFn as any)({ data: { trackId, value } }),
    onSuccess: async () => {
      setValue("");
      await queryClient.invalidateQueries({
        queryKey: ["myEnrolments", session?.user?.id],
      });
    },
  });

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Make submission</CardTitle>
        <CardDescription>
          Placeholder submission form for this track.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!session?.user ? (
          <Button render={<Link to="/sign-in" />}>Sign in to submit</Button>
        ) : !isEnrolled ? (
          <p className="text-sm text-muted-foreground">
            Enrol in this track before making a submission.
          </p>
        ) : (
          <>
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Enter a placeholder submission"
            />
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || value.trim().length === 0}
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit
            </Button>
            {mutation.isError && (
              <p className="text-sm font-medium text-destructive">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "Submission failed."}
              </p>
            )}
            {mutation.isSuccess && (
              <p className="text-sm text-muted-foreground">
                Submission created for this track.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
