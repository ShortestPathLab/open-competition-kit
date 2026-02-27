import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";
import sdk from "sdk";
import { authClient } from "src/lib/auth-client";
import { PageHeader } from "*/components/page-header";

export const Route = createFileRoute("/competitions/$id/tracks/$trackId")({
  component: TrackDetailsPage,
});

const enrolInTrack = createServerFn({ method: "POST" }).handler(
  async (ctx: any) => {
    const data = ctx.data as { userId: string; trackId: string };
    // Pretend this method exists
    // @ts-ignore
    await sdk.enrolments.enrol(data.userId, data.trackId);
    return { success: true };
  },
);

const tracks = [
  {
    id: "dynamic",
    name: "Dynamic",
    description:
      "Navigate evolving grid maps that change between queries. Algorithms must quickly adapt to environmental shifts while maintaining performance.",
  },
  {
    id: "anyangle",
    name: "Anyangle",
    description:
      "Navigate evolving grid maps that change between queries. Algorithms must quickly adapt to environmental shifts while maintaining performance.",
  },
  {
    id: "classic",
    name: "Classic",
    description:
      "Navigate evolving grid maps that change between queries. Algorithms must quickly adapt to environmental shifts while maintaining performance.",
  },
];

function TrackDetailsPage() {
  // @ts-ignore
  const { id: competitionId, trackId } = Route.useParams();
  const { data: session } = authClient.useSession();
  const enrolFn = useServerFn(enrolInTrack);

  const track = tracks.find((t) => t.id === trackId);

  const mutation = useMutation({
    mutationFn: () => {
      if (!session?.user?.id) throw new Error("No user id");
      return enrolFn({ data: { userId: session.user.id, trackId } });
    },
    onSuccess: () => {
      // In a real app we might invalidate queries or redirect
      alert("Successfully enrolled!");
    },
  });

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

      <div className="rounded-xl border border-border p-8 bg-card">
        <h2 className="text-xl font-semibold mb-4">Enrollment</h2>
        <p className="text-muted-foreground mb-6">
          To participate in this track and start submitting your agents, you
          need to enroll first.
        </p>

        {session?.user ? (
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Enrol in this track
          </button>
        ) : (
          <div className="flex flex-col gap-4 items-start">
            <p className="text-destructive text-sm font-medium">
              You must be signed in to enroll.
            </p>
            <Link
              to="/sign-in"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
