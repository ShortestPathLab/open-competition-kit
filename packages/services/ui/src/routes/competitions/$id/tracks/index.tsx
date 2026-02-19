import { createFileRoute } from "@tanstack/react-router";
import { SearchInput } from "*/components/search-input";
import { TrackCard } from "*/components/track-card";

export const Route = createFileRoute("/competitions/$id/tracks/")({
  component: TracksPage,
});

const tracks = [
  {
    name: "Dynamic",
    description:
      "Navigate evolving grid maps that change between queries. Algorithms must quickly adapt to environmental shifts while maintaining performance.",
  },
  {
    name: "Anyangle",
    description:
      "Navigate evolving grid maps that change between queries. Algorithms must quickly adapt to environmental shifts while maintaining performance.",
  },
  {
    name: "Classic",
    description:
      "Navigate evolving grid maps that change between queries. Algorithms must quickly adapt to environmental shifts while maintaining performance.",
  },
];

export default function TracksPage() {
  return (
    <div>
      <SearchInput placeholder="Search tracks" />
      <div className="mt-6 grid grid-cols-2 gap-4">
        {tracks.map((track) => (
          <TrackCard
            key={track.name}
            name={track.name}
            description={track.description}
          />
        ))}
      </div>
    </div>
  );
}
