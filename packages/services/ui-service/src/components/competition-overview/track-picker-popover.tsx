import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { TrackSummary } from "@/lib/competition-data";
import { useRouter } from "@tanstack/react-router";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useState } from "react";

/**
 * The page's primary action. It cannot go straight anywhere: entering is a
 * track-level act, so the button's job is to ask which one.
 */
export function TrackPickerPopover({
  competitionId,
  tracks,
}: {
  competitionId: string;
  tracks: TrackSummary[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button size="lg" className="h-10 px-5" />}>
        Enter a track
        <ArrowRight />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-3">
        <PopoverHeader className="px-1">
          <PopoverTitle>Choose a track</PopoverTitle>
          <PopoverDescription>
            Participation happens at the track level.
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col gap-1">
          {tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => {
                setOpen(false);
                router.navigate({
                  to: "/competitions/$id/tracks/$trackId",
                  params: { id: competitionId, trackId: track.id },
                });
              }}
              className="flex min-h-16 w-full items-start justify-between gap-3 rounded-md border border-border/40 px-3 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block font-medium">{track.name}</span>
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
  );
}
