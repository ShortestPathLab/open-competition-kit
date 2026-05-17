import { Button } from "*/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "*/components/ui/card";
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
import type { $props } from "@open-competition-kit/sdk";
import { useKitComponent } from "src/hooks/use-kit-component";
import { authClient } from "src/lib/auth-client";
import type { CompetitionSummary } from "src/lib/competition-data";
import { queryClient } from "src/router";
import { EnrolmentCard } from "./enrolment-card";
import { getEnrollmentStatus } from "src/lib/enrolment-fn";
import { getLoadedForm } from "src/lib/form-fn";
import { createSubmission } from "src/lib/submission-fn";
import { resolveId } from "src/lib/configure-user";

interface SubmissionCreatorProps {
  competition: CompetitionSummary;
  initialTrackId?: string;
}

type SubmissionFormValues = Parameters<
  NonNullable<(typeof $props.form.ui)["onSubmit"]>
>[0];

export function SubmissionCreator({
  competition,
  initialTrackId,
}: SubmissionCreatorProps) {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const fetchEnrollmentStatus = useServerFn(getEnrollmentStatus);
  const getLoadedFormFn = useServerFn(getLoadedForm);
  const submitFn = useServerFn(createSubmission);
  const tracks = competition.tracks;
  const defaultTrackId = useMemo(() => {
    if (initialTrackId && tracks.some((track) => track.id === initialTrackId)) {
      return initialTrackId;
    }
    return tracks[0]?.id ?? "";
  }, [initialTrackId, tracks]);
  const [trackId, setTrackId] = useState(defaultTrackId);

  useEffect(() => {
    setTrackId(defaultTrackId);
  }, [defaultTrackId]);

  const SubmissionForm = useKitComponent(
    "form.ui",
    { competitions: { tracks: trackId } },
    { enabled: !!trackId },
  );

  const selectedTrack = tracks.find((track) => track.id === trackId);

  const { data: isEnrolled = false, isLoading: enrollmentLoading } = useQuery({
    queryKey: ["enrollmentStatus", session?.user?.id, trackId],
    queryFn:
      session?.user?.id && trackId ?
        () =>
          fetchEnrollmentStatus({
            data: { userId: resolveId(session.user), trackId },
          })
      : skipToken,
  });

  const {
    data: formDef,
    isLoading: formLoading,
    isError: formIsError,
    error: formError,
  } = useQuery({
    queryKey: ["submissionForm", session?.user?.id, trackId],
    queryFn:
      session?.user?.id && trackId && isEnrolled ?
        () => getLoadedFormFn({ data: trackId })
      : skipToken,
  });

  const mutation = useMutation({
    mutationFn: (values: SubmissionFormValues) =>
      submitFn({ data: { trackId, value: values } }),
    onSuccess: async (result) => {
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
        params: { submissionId: result.submission },
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
            Choose a track, review its rules, and complete the submission form.
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
            {selectedTrack ?
              <p className="text-sm text-muted-foreground">
                {selectedTrack.description}
              </p>
            : null}
          </div>

          {!selectedTrack ?
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Choose a track to continue.
            </div>
          : <>
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

              {session?.user && isEnrolled ?
                <div className="space-y-4">
                  {formLoading ?
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading submission form.
                    </div>
                  : null}

                  {formIsError ?
                    <p className="text-sm font-medium text-destructive">
                      {formError instanceof Error ?
                        formError.message
                      : "Submission form failed to load."}
                    </p>
                  : null}

                  {formDef ?
                    <SubmissionForm
                      def={formDef}
                      onSubmit={async (values) => {
                        await mutation.mutateAsync(values);
                      }}
                    />
                  : null}

                  <div className="flex flex-wrap items-center gap-3">
                    {mutation.isPending ?
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating submission.
                      </div>
                    : null}
                    <p className="text-sm text-muted-foreground">
                      {mutation.isPending ?
                        "Submission will be created shortly."
                      : `Submission will be created for ${selectedTrack.name}.`}
                    </p>
                  </div>

                  {mutation.isError ?
                    <p className="text-sm font-medium text-destructive">
                      {mutation.error instanceof Error ?
                        mutation.error.message
                      : "Submission failed."}
                    </p>
                  : null}

                  {mutation.isSuccess ?
                    <p className="text-sm text-muted-foreground">
                      Submission created for {selectedTrack.name}.
                    </p>
                  : null}
                </div>
              : null}
            </>
          }
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
