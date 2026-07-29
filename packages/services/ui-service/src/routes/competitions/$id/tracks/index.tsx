import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { CompetitionPageHeader } from "*/components/competition-page-header";
import { HeaderMeta, PageBody } from "*/components/page-header-band";
import { SearchInput } from "*/components/search-input";
import { useCompetition } from "src/lib/competition-fn";
import { TrackCard } from "*/components/track-card";
import { Skeleton } from "*/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "*/components/ui/empty";
import { Layers3, SearchX } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
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

function TracksPage() {
  const { id } = Route.useParams();
  const { data: competition } = useCompetition(id);
  const fetchTracks = useServerFn(getTracks);
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["competitionTracks", id],
    queryFn: () => (fetchTracks as any)({ data: id }),
  });

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const filteredTracks = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return tracks as TrackSummary[];
    return (tracks as TrackSummary[]).filter((track) =>
      `${track.name} ${track.description}`.toLowerCase().includes(query),
    );
  }, [tracks, deferredSearch]);

  return (
    <>
      <CompetitionPageHeader
        competitionId={id}
        competitionName={competition?.name}
        title="Tracks"
        description="Participation happens at the track level. Pick one to see its rules, its window, and how to enter."
        meta={
          <HeaderMeta>
            <span>
              <b>{tracks.length}</b> {tracks.length === 1 ? "track" : "tracks"}
            </span>
          </HeaderMeta>
        }
        tabs
      />
      <PageBody>
        <SearchInput
          placeholder="Search tracks"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="mt-6 flex flex-col gap-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-24 w-full rounded-xl"
                role="status"
                aria-label="Loading"
              />
            ))
          ) : tracks.length === 0 ? (
            <Empty className="rounded-2xl border border-dashed border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Layers3 />
                </EmptyMedia>
                <EmptyTitle>No tracks yet</EmptyTitle>
                <EmptyDescription>
                  This competition doesn't have any tracks published yet.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : filteredTracks.length === 0 ? (
            <Empty className="rounded-2xl border border-dashed border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchX />
                </EmptyMedia>
                <EmptyTitle>No tracks match your search</EmptyTitle>
                <EmptyDescription>
                  Try a different track name or keyword.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            filteredTracks.map((track) => (
              <TrackCard
                key={track.id}
                id={track.id}
                competitionId={id}
                name={track.name}
                description={track.description}
              />
            ))
          )}
        </div>
      </PageBody>
    </>
  );
}
