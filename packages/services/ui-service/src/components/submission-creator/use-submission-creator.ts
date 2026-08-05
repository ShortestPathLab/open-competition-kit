import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { $props } from "@open-competition-kit/sdk";
import { useKitComponent } from "@/hooks/use-kit-component";
import { authClient } from "@/lib/auth-client";
import type { CompetitionSummary } from "@/lib/competition-data";
import { getEnrollmentStatus } from "@/lib/enrolment-fn";
import { getLoadedForm } from "@/lib/form-fn";
import { useTrackReports } from "@/lib/gate-fn";
import { createSubmission, useSubmissionGate } from "@/lib/submission-fn";
import { queryClient } from "@/router";

export type SubmissionFormValues = Parameters<NonNullable<(typeof $props.form.ui)["onSubmit"]>>[0];

/**
 * Everything the submission page needs to know, gathered in one place.
 *
 * The five queries below are deliberately separate rather than one call: each
 * depends on the answer to the one above it, so a track a competitor is not
 * enrolled in never asks for a gate verdict, and a closed gate never fetches a
 * form. Collecting them here rather than in the component keeps that chain
 * readable and leaves the parts underneath rendering props they were handed.
 */
export function useSubmissionCreator(competition: CompetitionSummary, initialTrackId?: string) {
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
  // Drives the summary above the form only. Whether the form opens is the
  // server's call: `useSubmissionGate` below runs the same chain that decides a
  // real submission, and these reports are the readable half of it.
  const { reports } = useTrackReports(trackId, session?.user?.id);

  const { data: isEnrolled = false, isLoading: enrollmentLoading } = useQuery({
    queryKey: ["enrollmentStatus", session?.user?.id, trackId],
    queryFn:
      session?.user?.id && trackId ? () => fetchEnrollmentStatus({ data: { trackId } }) : skipToken,
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
    mutationFn: (values: SubmissionFormValues) => submitFn({ data: { trackId, value: values } }),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["competitionSubmissions", session?.user?.id, competition.id],
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

  /**
   * Switching track clears the last attempt's outcome along with it. A red
   * "Submission failed" left over from a different track is describing
   * something the competitor is no longer looking at.
   */
  const selectTrack = useCallback(
    (nextTrackId: string | null | undefined) => {
      setTrackId(nextTrackId ?? defaultTrackId);
      mutation.reset();
    },
    [defaultTrackId, mutation],
  );

  return {
    tracks,
    trackId,
    selectTrack,
    selectedTrack,
    reports,
    isSignedIn: Boolean(session?.user),
    isEnrolled,
    enrollmentLoading,
    /** Enrolled and signed in, so the gate's answer is worth showing. */
    isEligible: Boolean(session?.user) && isEnrolled,
    gate,
    gateLoading,
    isOpen,
    SubmissionForm,
    formDef,
    formLoading,
    formIsError,
    formError,
    mutation,
  };
}

export type SubmissionCreatorState = ReturnType<typeof useSubmissionCreator>;
