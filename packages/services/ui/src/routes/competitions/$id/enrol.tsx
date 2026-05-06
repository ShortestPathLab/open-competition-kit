import { Loader } from "*/components/loader";
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
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import sdk, { unsafe } from "sdk";
import { authClient } from "src/lib/auth-client";
import { ensureAuthSession } from "src/lib/auth.server";
import { useCompetition } from "src/lib/competition-fn";
import { queryClient } from "src/router";
import { toast } from "sonner";
import { z } from "zod";

const enrolSearch = z.object({
  trackId: z.string().optional(),
});

const enrolInput = z.object({
  trackId: z.string(),
});

const enrolInTrack = createServerFn({ method: "POST" })
  .inputValidator(enrolInput)
  .handler(async ({ data }) => {
    const session = await ensureAuthSession();
    return unsafe(sdk.enrolments.enrol(session.user.id, data.trackId));
  });

export const Route = createFileRoute("/competitions/$id/enrol")({
  validateSearch: enrolSearch,
  component: CompetitionEnrolPage,
});

function CompetitionEnrolPage() {
  const { id } = Route.useParams();
  const { trackId } = Route.useSearch();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: competition } = useCompetition(id);
  const enrolFn = useServerFn(enrolInTrack);

  const selectedTrack =
    competition?.tracks.find((track) => track.id === trackId) ??
    competition?.tracks[0];
  const trackItems =
    competition?.tracks.map((track) => ({
      label: track.name,
      value: track.id,
    })) ?? [];

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedTrack) throw new Error("No track selected");
      return enrolFn({
        data: {
          trackId: selectedTrack.id,
        },
      });
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
      router.navigate({ to: "/competitions/$id", params: { id } });
    },
  });

  if (!competition) return <Loader />;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Enrol in a track</h2>
        <p className="text-sm text-muted-foreground">
          Choose the track you want to participate in, then confirm your
          enrolment.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="border-b border-border/60">
          <CardTitle>Choose a track</CardTitle>
          <CardDescription>
            Participation happens at the track level for this competition.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          {!session?.user ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">Sign in to enrol</h3>
                <p className="text-sm text-muted-foreground">
                  Your enrolments are attached to your account.
                </p>
              </div>
              <Button render={<Link to="/sign-in" />}>Sign in</Button>
            </div>
          ) : competition.tracks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              This competition does not have any tracks available yet.
            </div>
          ) : (
            <>
              <div className="grid gap-2 md:max-w-md">
                <label htmlFor="track-picker" className="text-sm font-medium">
                  Track
                </label>
                <Select
                  items={trackItems}
                  value={selectedTrack?.id}
                  onValueChange={(value) => {
                    router.navigate({
                      to: "/competitions/$id/enrol",
                      params: { id },
                      search: { trackId: value ?? competition.tracks[0]?.id },
                    });
                  }}
                >
                  <SelectTrigger id="track-picker" className="w-full">
                    <SelectValue placeholder="Choose a track" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Tracks</SelectLabel>
                      {competition.tracks.map((track) => (
                        <SelectItem key={track.id} value={track.id}>
                          {track.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {selectedTrack ? (
                <div className="rounded-2xl border border-border/70 bg-background p-4">
                  <h3 className="text-base font-semibold text-foreground">
                    {selectedTrack.name}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedTrack.description}
                  </p>
                </div>
              ) : null}

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending || !selectedTrack}
                >
                  {mutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Enrol
                </Button>
                <Button
                  variant="outline"
                  render={<Link to="/competitions/$id" params={{ id }} />}
                >
                  Cancel
                </Button>
              </div>

              {mutation.isError ? (
                <p className="text-sm font-medium text-destructive">
                  {mutation.error instanceof Error
                    ? mutation.error.message
                    : "Enrolment failed."}
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
