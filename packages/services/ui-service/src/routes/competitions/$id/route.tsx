import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "*/components/ui/breadcrumb";
import { CompetitionTabs } from "*/components/competition-tabs";
import { Button } from "*/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "*/components/ui/popover";
import { Stat, StatStrip } from "*/components/stat-strip";
import {
  createFileRoute,
  Link,
  Outlet,
  useRouter,
} from "@tanstack/react-router";
import { ArrowRight, ChevronRight } from "lucide-react";
import BoringAvatar from "boring-avatars";
import { useState } from "react";
import { useCompetition } from "src/lib/competition-fn";
import { useCompetitionLeaderboards } from "src/lib/leaderboard-fn";

export const Route = createFileRoute("/competitions/$id")({
  component: CompetitionLayout,
});

function CompetitionLayout() {
  const { id } = Route.useParams();
  const router = useRouter();
  const [trackPickerOpen, setTrackPickerOpen] = useState(false);

  const { data: competition } = useCompetition(id);
  const { data: leaderboards } = useCompetitionLeaderboards(id);

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card [view-transition-name:competition-header]">
        <div className="mx-auto max-w-7xl">
          <div className="px-6 pt-6 pb-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink render={<Link to="/competitions" />}>
                    Competitions
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {competition?.name ?? "Competition"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="mt-5 flex items-start gap-4 sm:gap-5">
              <div className="hidden size-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted sm:block">
                {competition ?
                  <BoringAvatar
                    name={competition.name}
                    square
                    preserveAspectRatio="none"
                    className="h-full w-full"
                  />
                : null}
              </div>
              <div className="min-w-0">
                <h1 className=" text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                  {competition?.name ?? " "}
                </h1>
                <p className="mt-2.5 text-sm text-muted-foreground">
                  {competition?.organiser ?? " "}
                </p>
                <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {competition?.description ?? ""}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Popover
                    open={trackPickerOpen}
                    onOpenChange={setTrackPickerOpen}
                  >
                    <PopoverTrigger
                      render={<Button size="lg" className="h-10 px-5" />}
                    >
                      Enter a track
                      <ArrowRight />
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-96 p-3">
                      <PopoverHeader className="px-1">
                        <PopoverTitle>Choose a track</PopoverTitle>
                        <PopoverDescription>
                          Participation happens at the track level.
                        </PopoverDescription>
                      </PopoverHeader>
                      <div className="flex flex-col gap-1">
                        {competition?.tracks?.map?.((track) => (
                          <button
                            key={track.id}
                            onClick={() => {
                              setTrackPickerOpen(false);
                              router.navigate({
                                to: "/competitions/$id/tracks/$trackId",
                                params: { id, trackId: track.id },
                              });
                            }}
                            className="flex min-h-16 w-full items-start justify-between gap-3 rounded-md border border-border/40 px-3 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="min-w-0">
                              <span className="block font-medium">
                                {track.name}
                              </span>
                              <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                                {track.description}
                              </span>
                            </span>
                            <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-10 px-5"
                    render={
                      <Link to="/competitions/$id/rules" params={{ id }} />
                    }
                  >
                    Read the rules
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-card border-b border-border [view-transition-name:competition-stat-strip]">
        <StatStrip surface={false} className="max-w-7xl sm:px-4 mx-auto">
          <Stat label="Tracks" value={competition?.tracks.length ?? 0} />
          <Stat label="Leaderboards" value={leaderboards?.length ?? 0} />
          <Stat label="Submissions" value={0} />
        </StatStrip>
      </div>
      <div className="sticky top-0 z-20 border-b border-border bg-card [view-transition-name:competition-tabs]">
        <div className="mx-auto max-w-7xl sm:px-4">
          <CompetitionTabs competitionId={id} />
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
