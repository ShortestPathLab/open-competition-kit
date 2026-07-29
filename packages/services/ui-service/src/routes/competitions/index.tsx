import { CompetitionCard } from "*/components/competition-card";
import { PageHeader } from "*/components/page-header";
import { SearchInput } from "*/components/search-input";
import { CardSkeleton } from "*/components/skeletons";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "*/components/ui/empty";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { SearchX, Trophy } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { listCompetitionSummaries } from "src/lib/competition-data";
import { isDraft } from "@open-competition-kit/sdk/visibility";

export const Route = createFileRoute("/competitions/")({
  component: CompetitionsPage,
});

const getCompetitions = createServerFn().handler(async () => {
  return listCompetitionSummaries();
});

function CompetitionsPage() {
  const fetchCompetitions = useServerFn(getCompetitions);
  const { data: competitions = [], isLoading } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => fetchCompetitions(),
  });

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const filteredCompetitions = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return competitions;
    return competitions.filter((comp) =>
      `${comp.name} ${comp.organiser}`.toLowerCase().includes(query),
    );
  }, [competitions, deferredSearch]);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-6 py-8">
        <PageHeader
          title="Competitions"
          description="Browse the competitions on offer, enrol in a track, and submit your work for evaluation."
          actions={
            <div className="w-full sm:w-72">
              <SearchInput
                placeholder="Search competitions"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          }
        />
        {isLoading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
        ) : competitions.length === 0 ? (
          <Empty className="mt-8 rounded-2xl border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>No competitions yet</EmptyTitle>
              <EmptyDescription>
                There are no competitions to browse right now. Check back soon.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : filteredCompetitions.length === 0 ? (
          <Empty className="mt-8 rounded-2xl border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>No competitions match your search</EmptyTitle>
              <EmptyDescription>
                Try a different name or organiser.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCompetitions.map((comp) => (
              <CompetitionCard
                key={comp.id}
                id={comp.id}
                name={comp.name}
                organiser={comp.organiser}
                trackCount={comp.tracks.length}
                isDraft={isDraft(comp)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
