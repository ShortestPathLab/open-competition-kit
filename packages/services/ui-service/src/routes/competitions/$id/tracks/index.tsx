import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { SearchInput } from "*/components/search-input";
import { TrackCard } from "*/components/track-card";
import {
  getCompetitionSummary,
  type TrackSummary,
} from "src/lib/competition-data";
import { z } from "zod";

export const Route = createFileRoute("/competitions/$id/tracks/")({
  component: TracksPage,
});

const getTracks = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    return (await getCompetitionSummary(id)).tracks;
  });

export default function TracksPage() {
  const { id } = Route.useParams();
  const fetchTracks = useServerFn(getTracks);
  const { data: tracks = [] } = useQuery({
    queryKey: ["competitionTracks", id],
    queryFn: () => (fetchTracks as any)({ data: id }),
  });

  return (
    <div>
      <SearchInput placeholder="Search tracks" />
      <div className="mt-6 flex flex-col gap-4">
        {tracks.map((track: TrackSummary) => (
          <TrackCard
            key={track.id}
            id={track.id}
            competitionId={id}
            name={track.name}
            description={track.description}
          />
        ))}
      </div>
    </div>
  );
}
