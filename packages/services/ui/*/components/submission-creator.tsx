import { Button } from "*/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "*/components/ui/card";
import { Input } from "*/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "*/components/ui/select";
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { authClient } from "src/lib/auth-client";
import type { CompetitionSummary } from "src/lib/competition-data";
import { queryClient } from "src/router";
import { EnrolmentCard } from "./enrolment-card";
import { getEnrollmentStatus } from "src/lib/enrolment-fn";
import { createSubmission } from "src/lib/submission-fn";

interface SubmissionCreatorProps {
  competition: CompetitionSummary;
  initialTrackId?: string;
}

export function SubmissionCreator({
  competition,
  initialTrackId,
}: SubmissionCreatorProps) {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const fetchEnrollmentStatus = useServerFn(getEnrollmentStatus);
  const submitFn = useServerFn(createSubmission);
  const tracks = competition.tracks;
  const defaultTrackId = useMemo(() => {
    if (initialTrackId && tracks.some((track) => track.id === initialTrackId)) {
      return initialTrackId;
    }
    return tracks[0]?.id ?? "";
  }, [initialTrackId, tracks]);
  const [trackId, setTrackId] = useState(defaultTrackId);
  const [value, setValue] = useState("");

  useEffect(() => {
    setTrackId(defaultTrackId);
  }, [defaultTrackId]);

  const selectedTrack = tracks.find((track) => track.id === trackId);

  const { data: isEnrolled = false, isLoading: enrollmentLoading } = useQuery({
    queryKey: ["enrollmentStatus", session?.user?.id, competition.id, trackId],
    queryFn:
      session?.user?.id && trackId
        ? () =>
            fetchEnrollmentStatus({
              data: {
                userId: session.user.id,
                competitionId: competition.id,
                trackId,
              },
            })
        : skipToken,
  });

  console.log(session?.user.id, competition.id, trackId);

  const mutation = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          competitionId: competition.id,
          trackId,
          value,
        },
      }),
    onSuccess: async (result) => {
      setValue("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            "competitionSubmissions",
            session?.user?.id,
            competition.id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: ["userSubmissions", session?.user?.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myEnrolments", session?.user?.id],
        }),
      ]);
      await router.navigate({
        to: "/me/submissions/$submissionId",
        params: { submissionId: result.submission.id },
      });
    },
  });

  if (tracks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        This competition does not have any tracks available for submission yet.
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Create a submission</h2>
          <p className="text-sm text-muted-foreground">
            Choose a track, review its rules, and send a placeholder submission.
          </p>
        </div>

        <div className="space-y-5">
          <div className="grid gap-2">
            <label htmlFor="track-picker" className="text-sm font-medium">
              Track
            </label>
            <Select
              items={tracks.map((track) => ({
                label: track.name,
                value: track.id,
              }))}
              value={trackId}
              onValueChange={(nextValue) => {
                setTrackId(nextValue ?? defaultTrackId);
                setValue("");
                mutation.reset();
              }}
            >
              <SelectTrigger id="track-picker" className="w-full">
                <SelectValue placeholder="Choose a track" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Tracks</SelectLabel>
                  {tracks.map((track) => (
                    <SelectItem key={track.id} value={track.id}>
                      {track.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {selectedTrack ? (
              <p className="text-sm text-muted-foreground">
                {selectedTrack.description}
              </p>
            ) : null}
          </div>

          {!selectedTrack ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Choose a track to continue.
            </div>
          ) : (
            <>
              <EnrolmentCard
                isSignedIn={Boolean(session?.user)}
                isLoading={enrollmentLoading}
                isEnrolled={isEnrolled}
                title="Track readiness"
                description={`Check whether ${selectedTrack.name} is ready for submission.`}
                signInAction={
                  <Button render={<Link to="/sign-in" />}>Sign in</Button>
                }
                enrolAction={
                  <Button
                    render={
                      <Link
                        to="/competitions/$id/enrol"
                        params={{ id: competition.id }}
                        search={{ trackId: selectedTrack.id }}
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
                        to="/competitions/$id/tracks/$trackId"
                        params={{
                          id: competition.id,
                          trackId: selectedTrack.id,
                        }}
                      />
                    }
                  >
                    Open track
                  </Button>
                }
              />

              {session?.user && isEnrolled ? (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <label
                      htmlFor="submission-value"
                      className="text-sm font-medium"
                    >
                      Submission
                    </label>
                    <Input
                      id="submission-value"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      placeholder="Enter a placeholder submission"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={() => mutation.mutate()}
                      disabled={mutation.isPending || value.trim().length === 0}
                    >
                      {mutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Submit
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Submission will be created for {selectedTrack.name}.
                    </p>
                  </div>

                  {mutation.isError ? (
                    <p className="text-sm font-medium text-destructive">
                      {mutation.error instanceof Error
                        ? mutation.error.message
                        : "Submission failed."}
                    </p>
                  ) : null}

                  {mutation.isSuccess ? (
                    <p className="text-sm text-muted-foreground">
                      Submission created for {selectedTrack.name}.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="border-b border-border/60">
          <CardTitle>{selectedTrack?.name ?? "Rules"}</CardTitle>
          <CardDescription>
            {selectedTrack?.description ??
              "Select a track to review its rules."}
          </CardDescription>
        </CardHeader>
        <CardContent className="prose mt-4 max-w-none prose-sm">
          <Markdown remarkPlugins={[remarkGfm]}>
            {selectedTrack?.rules ||
              "No rules have been published for this track yet."}
          </Markdown>
        </CardContent>
      </Card>
    </div>
  );
}
