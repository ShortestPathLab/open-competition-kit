import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { queryClient } from "@/router";
import { authClient } from "./auth-client";
import { useCompetition } from "./competition-fn";
import { enrolInTrack } from "./enrolment-fn";

/**
 * The enrol step: which track, and what happened when you entered it.
 *
 * The chosen track lives in the URL rather than in state, so the picker below
 * navigates instead of setting anything. That keeps a half-filled enrol page
 * shareable and survives a reload, which matters because the link competitors
 * are handed usually names the track already.
 */
export function useEnrolPage(competitionId: string, trackId?: string) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: competition } = useCompetition(competitionId);
  const enrolFn = useServerFn(enrolInTrack);

  const selectedTrack =
    competition?.tracks.find((track) => track.id === trackId) ?? competition?.tracks[0];

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedTrack) throw new Error("No track selected");
      return enrolFn({ data: { trackId: selectedTrack.id } });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["myEnrolments", session?.user?.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["enrollmentStatus", session?.user?.id, selectedTrack?.id],
        }),
      ]);
      toast.success("Enrolled successfully");
    },
  });

  return {
    competition,
    selectedTrack,
    isSignedIn: Boolean(session?.user),
    mutation,
    /**
     * Enrolling can do more than write a row. An integration may have created a
     * repository, granted access, and left instructions worth reading, and this
     * page used to navigate away half a second later with a toast as the only
     * acknowledgement. What happened stays on screen until the reader leaves it.
     */
    enrolment: mutation.data,
    selectTrack: (nextTrackId: string | null | undefined) => {
      router.navigate({
        to: "/competitions/$id/enrol",
        params: { id: competitionId },
        search: { trackId: nextTrackId ?? competition?.tracks[0]?.id },
      });
    },
  };
}

export type EnrolPage = ReturnType<typeof useEnrolPage>;
