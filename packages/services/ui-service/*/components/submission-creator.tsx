import { Button } from "*/components/ui/button";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "*/components/panel";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "*/components/ui/select";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "*/components/ui/empty";
import { FormSkeleton } from "*/components/skeletons";
import {
  SubmissionWindowSummary,
  useWindowState,
} from "*/components/submission-window";
import { SurfaceSlot } from "*/components/surface-slot";
import { surface } from "@open-competition-kit/sdk/surface";
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Layers3, Loader2, LockKeyhole } from "lucide-react";
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
import { createSubmission, useSubmissionGate } from "src/lib/submission-fn";

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

  const { Component: SubmissionForm } = useKitComponent("form.ui", {
    accessor: { competitions: { tracks: trackId } },
    query: { enabled: !!trackId },
  });

  const selectedTrack = tracks.find((track) => track.id === trackId);
  // Drives the schedule panel only. Whether the form opens is the server's call,
  // since the deadline is one of several gates and the rest need the database.
  const windowState = useWindowState(selectedTrack ?? {});

  const { data: isEnrolled = false, isLoading: enrollmentLoading } = useQuery({
    queryKey: ["enrollmentStatus", session?.user?.id, trackId],
    queryFn:
      session?.user?.id && trackId
        ? () => fetchEnrollmentStatus({ data: { trackId } })
        : skipToken,
  });

  const { data: gate, isLoading: gateLoading } = useSubmissionGate(
    session?.user?.id,
    isEnrolled ? trackId : undefined,
  );
  // Closed until the server says otherwise. An unanswered gate is not an open
  // one, and the alternative flashes a form that is about to be taken away.
  const isOpen = gate?.allowed === true;

  const {
    data: formDef,
    isLoading: formLoading,
    isError: formIsError,
    error: formError,
  } = useQuery({
    queryKey: ["submissionForm", session?.user?.id, trackId],
    queryFn:
      session?.user?.id && trackId && isEnrolled
        ? () => getLoadedFormFn({ data: trackId })
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
      <Empty className="rounded-2xl border border-dashed border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Layers3 />
          </EmptyMedia>
          <EmptyTitle>No tracks available</EmptyTitle>
          <EmptyDescription>
            This competition does not have any tracks available for submission
            yet.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      {/* No heading of its own. The page above already says this is a new
          submission, and two titles saying the same thing in different words
          read as two different things. */}
      <div className="space-y-6">
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
            {selectedTrack ? (
              <p className="text-sm text-muted-foreground">
                {selectedTrack.description}
              </p>
            ) : null}
            {selectedTrack ? (
              <SubmissionWindowSummary
                window={selectedTrack}
                state={windowState}
              />
            ) : null}
          </div>

          {!selectedTrack ? (
            <Empty className="rounded-2xl border border-dashed border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Layers3 />
                </EmptyMedia>
                <EmptyTitle>Choose a track to continue</EmptyTitle>
                <EmptyDescription>
                  Pick a track above to review its rules and open the submission
                  form.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
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

              {/* Above the form rather than beside it: how to prepare a
                  submission is worth reading before filling one in, and the rail
                  on the right belongs to the track's rules. */}
              <SurfaceSlot
                surface={surface.std.submissionNew}
                subject={{
                  competition: competition.id,
                  track: selectedTrack.id,
                }}
                layout="inline"
              />

              {session?.user && isEnrolled && gateLoading ? (
                <FormSkeleton fields={4} />
              ) : null}

              {session?.user && isEnrolled && gate && !gate.allowed ? (
                <Empty className="rounded-2xl border border-dashed border-border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <LockKeyhole />
                    </EmptyMedia>
                    <EmptyTitle>You cannot submit right now</EmptyTitle>
                    <EmptyDescription>
                      {/* Every refusal, not just the first. A competitor who is
                          past the deadline and out of attempts should not have to
                          fix one to discover the other. */}
                      <span className="flex flex-col gap-1.5">
                        {/* Keyed by position too: nothing stops two packages
                            from naming their gate the same thing. */}
                        {gate.refusals.map((refusal, index) => (
                          <span key={`${refusal.gate}-${index}`}>
                            {refusal.reason}
                          </span>
                        ))}
                      </span>
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}

              {session?.user && isEnrolled && isOpen ? (
                <div className="space-y-4">
                  {formLoading ? <FormSkeleton fields={4} /> : null}

                  {formIsError ? (
                    <p className="text-sm font-medium text-destructive">
                      {formError instanceof Error
                        ? formError.message
                        : "Submission form failed to load."}
                    </p>
                  ) : null}

                  {formDef ? (
                    <SubmissionForm
                      def={formDef}
                      onSubmit={async (values) => {
                        await mutation.mutateAsync(values);
                      }}
                    />
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    {mutation.isPending ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating submission.
                      </div>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      {mutation.isPending
                        ? "Submission will be created shortly."
                        : `Submission will be created for ${selectedTrack.name}.`}
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

      <Panel>
        <PanelHeader className="flex-col items-start gap-1">
          <PanelTitle>{selectedTrack?.name ?? "Rules"}</PanelTitle>
          <PanelDescription>
            {selectedTrack?.description ??
              "Select a track to review its rules."}
          </PanelDescription>
        </PanelHeader>
        <PanelBody>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <Markdown remarkPlugins={[remarkGfm]}>
              {selectedTrack?.rules ||
                "No rules have been published for this track yet."}
            </Markdown>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
