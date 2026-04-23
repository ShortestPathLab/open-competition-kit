import { CompetitionTabs } from "*/components/competition-tabs";
import { PageHeader } from "*/components/page-header";
import { Button } from "*/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "*/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  getCompetitionSummary,
  type TrackSummary,
} from "src/lib/competition-data";

export const Route = createFileRoute("/competitions/$id")({
  component: CompetitionLayout,
});

const getCompetition = createServerFn({ method: "GET" }).handler(
  async (ctx: any) => {
    const id = ctx.data as string;
    return getCompetitionSummary(id);
  },
);

function CompetitionLayout() {
  const { id } = Route.useParams();
  const router = useRouter();
  const [trackPickerOpen, setTrackPickerOpen] = useState(false);
  const fetchCompetition = useServerFn(getCompetition);

  const { data: competition } = useQuery({
    queryKey: ["competition", id],
    queryFn: () => (fetchCompetition as any)({ data: id }),
  });

  return (
    <div className="min-h-screen">
      <div className="bg-muted/30 border-b border-border [view-transition-name:competition-header]">
        <div className="mx-auto max-w-5xl px-6 pt-8 pb-0">
          <PageHeader
            title={competition?.name}
            description={competition?.description}
            actions={
              <Popover open={trackPickerOpen} onOpenChange={setTrackPickerOpen}>
                <PopoverTrigger
                  render={<Button size="lg" />}
                >
                  Participate in this competition
                </PopoverTrigger>
                <PopoverContent align="end" className="w-96 p-3">
                  <PopoverHeader className="px-1">
                    <PopoverTitle>Choose a track</PopoverTitle>
                    <PopoverDescription>
                      Participation happens at the track level.
                    </PopoverDescription>
                  </PopoverHeader>
                  <div className="flex flex-col gap-1">
                    {competition?.tracks.map((track: TrackSummary) => (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => {
                          setTrackPickerOpen(false);
                          router.navigate({
                            to: "/competitions/$id/tracks/$trackId",
                            params: { id, trackId: track.id },
                          });
                        }}
                        className="flex min-h-20 w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span>
                          <span className="block font-medium">
                            {track.name}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                            {track.description}
                          </span>
                        </span>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            }
          />
          <div className="mt-6">
            <CompetitionTabs competitionId={id} />
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
