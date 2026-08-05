import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TrackSummary } from "@/lib/competition-data";
import type { EnrolPage } from "@/lib/enrol-page-fn";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

/** Pick a track, read what it is, and commit. */
export function TrackChooser({
  competitionId,
  tracks,
  selectedTrack,
  onSelect,
  mutation,
}: {
  competitionId: string;
  tracks: TrackSummary[];
  selectedTrack: TrackSummary | undefined;
  onSelect: EnrolPage["selectTrack"];
  mutation: EnrolPage["mutation"];
}) {
  return (
    <>
      <div className="grid gap-2 md:max-w-md">
        <label htmlFor="track-picker" className="text-sm font-medium">
          Track
        </label>
        <Select
          items={tracks.map((track) => ({
            label: track.name,
            value: track.id,
          }))}
          value={selectedTrack?.id}
          onValueChange={onSelect}
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
      </div>

      {selectedTrack ? (
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <h3 className="text-base font-semibold text-foreground">{selectedTrack.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{selectedTrack.description}</p>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !selectedTrack}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Enrol
        </Button>
        <Button
          variant="outline"
          render={<Link to="/competitions/$id" params={{ id: competitionId }} />}
        >
          Cancel
        </Button>
      </div>

      {mutation.isError ? (
        <p className="text-sm font-medium text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : "Enrolment failed."}
        </p>
      ) : null}
    </>
  );
}
