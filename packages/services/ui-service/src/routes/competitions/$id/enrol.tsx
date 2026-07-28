import { PageSkeleton } from "*/components/skeletons";
import { Button } from "*/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "*/components/ui/empty";
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
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { Layers3, Loader2, Lock } from "lucide-react";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { authClient } from "src/lib/auth-client";
import { authMiddleware } from "src/lib/auth-server";
import { useCompetition } from "src/lib/competition-fn";
import { queryClient } from "src/router";
import { toast } from "sonner";
import { z } from "zod";
import { resolveId } from "src/lib/configure-user";

const enrolSearch = z.object({ trackId: z.string().optional() });

const enrolInput = z.object({ trackId: z.string() });

const enrolInTrack = createServerFn({ method: "POST" })
  .inputValidator(enrolInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context: { session } }) => {
    return unsafe(sdk.enrolments.enrol(resolveId(session.user), data.trackId));
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
      router.navigate({ to: "/competitions/$id", params: { id } });
    },
  });

  if (!competition) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Enrol in a track</h2>
        <p className="text-sm text-muted-foreground">
          Choose the track you want to participate in, then confirm your
          enrolment.
        </p>
      </div>

      <Panel>
        <PanelHeader className="flex-col items-start gap-1">
          <PanelTitle>Choose a track</PanelTitle>
          <PanelDescription>
            Participation happens at the track level for this competition.
          </PanelDescription>
        </PanelHeader>
        <PanelBody className="space-y-5">
          {!session?.user ? (
            <Empty className="border border-dashed border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Lock />
                </EmptyMedia>
                <EmptyTitle>Sign in to enrol</EmptyTitle>
                <EmptyDescription>
                  Your enrolments are attached to your account.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button render={<Link to="/sign-in" />}>Sign in</Button>
              </EmptyContent>
            </Empty>
          ) : competition.tracks.length === 0 ? (
            <Empty className="rounded-2xl border border-dashed border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Layers3 />
                </EmptyMedia>
                <EmptyTitle>No tracks available</EmptyTitle>
                <EmptyDescription>
                  This competition does not have any tracks available yet.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
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
                <div className="rounded-xl border border-border bg-muted/40 p-4">
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
        </PanelBody>
      </Panel>
    </div>
  );
}
