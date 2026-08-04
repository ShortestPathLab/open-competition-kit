import { SubmissionWindowSummary } from "@/components/submission-window";
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
import type { GateReport } from "@open-competition-kit/sdk/gate";

/** Which track a submission is for, and what its gates currently say. */
export function TrackPicker({
  tracks,
  trackId,
  onSelect,
  selectedTrack,
  reports,
}: {
  tracks: TrackSummary[];
  trackId: string;
  onSelect: (trackId: string | null | undefined) => void;
  selectedTrack: TrackSummary | undefined;
  reports: readonly GateReport[];
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor="track-picker" className="text-sm font-medium">
        Track
      </label>
      <Select
        items={tracks.map((track) => ({
          label: track.name,
          value: track.id,
        }))}
        value={trackId}
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
      {selectedTrack ? (
        <p className="text-sm text-muted-foreground">
          {selectedTrack.description}
        </p>
      ) : null}
      {selectedTrack ? <SubmissionWindowSummary reports={reports} /> : null}
    </div>
  );
}
