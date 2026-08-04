import { CompetitionPageHeader } from "@/components/competition-page-header";
import { PageBody } from "@/components/page-header-band";
import { PageSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SurfaceSlot } from "@/components/surface-slot";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { ArrowRight, CircleCheck, Layers3, Loader2, Lock } from "lucide-react";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { surface } from "@open-competition-kit/sdk/surface";
import { authClient } from "@/lib/auth-client";
import { authMiddleware } from "@/lib/auth-server";
import { useCompetition } from "@/lib/competition-fn";
import { ensureTrackAvailable } from "@/lib/competition-data";
import { queryClient } from "@/router";
import { toast } from "sonner";
import { z } from "zod";
import { resolveId } from "@/lib/configure-user";

const enrolSearch = z.object({ trackId: z.string().optional() });

const enrolInput = z.object({ trackId: z.string() });

const enrolInTrack = createServerFn({ method: "POST" })
  .inputValidator(enrolInput)
  .middleware([authMiddleware])
  .handler(async ({ data, context: { session } }) => {
    await ensureTrackAvailable(data.trackId);
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
    },
  });

  // Enrolling can do more than write a row. An integration may have created a
  // repository, granted access, and left instructions worth reading, and this
  // page used to navigate away half a second later with a toast as the only
  // acknowledgement. What happened stays on screen until the reader leaves it.
  const enrolment = mutation.data;

  if (!competition) return <PageSkeleton />;

  return (
    <>
      {/* No tabs, for the same reason the submission form has none: this is one
          step, and the breadcrumb is the way back out of it. */}
      <CompetitionPageHeader
        competitionId={id}
        competitionName={competition.name}
        trail={[{ label: "Tracks", section: "tracks" }]}
        title="Enrol in a track"
        crumb="Enrol"
        description="Pick the track you want to compete in, then confirm. You can enter more than one."
      />
      <PageBody className="space-y-6">
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
            ) : enrolment && selectedTrack ? (
              <div className="space-y-5">
                <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
                  <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" />
                  <div>
                    <p className="text-sm font-semibold text-success">
                      You are entered in {selectedTrack.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {competition.name} will count your submissions to this
                      track from now on.
                    </p>
                  </div>
                </div>

                {/* Whatever else enrolling set up. A package that created
                    something on the reader's behalf gets to say so here, while
                    it is still the thing that just happened. */}
                <SurfaceSlot
                  surface={surface.std.enrolmentDone}
                  subject={{
                    competition: id,
                    track: selectedTrack.id,
                    enrolment,
                  }}
                  layout="inline"
                />

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    render={
                      <Link
                        to="/competitions/$id/submissions/new"
                        params={{ id }}
                        search={{ trackId: selectedTrack.id }}
                      />
                    }
                  >
                    Make a submission
                    <ArrowRight />
                  </Button>
                  <Button
                    variant="outline"
                    render={
                      <Link
                        to="/competitions/$id/tracks/$trackId"
                        params={{ id, trackId: selectedTrack.id }}
                      />
                    }
                  >
                    Open track
                  </Button>
                </div>
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
      </PageBody>
    </>
  );
}
