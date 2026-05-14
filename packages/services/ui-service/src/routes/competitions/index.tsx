import { CompetitionCard } from "*/components/competition-card";
import { PageHeader } from "*/components/page-header";
import { SearchInput } from "*/components/search-input";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { listCompetitionSummaries } from "src/lib/competition-data";

export const Route = createFileRoute("/competitions/")({
  component: CompetitionsPage,
});

const getCompetitions = createServerFn().handler(async () => {
  return listCompetitionSummaries();
});

function CompetitionsPage() {
  const fetchCompetitions = useServerFn(getCompetitions);
  const { data: competitions = [] } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => fetchCompetitions(),
  });
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader
          title="Competitions"
          description={
            "Participate in smth smth by\nsmth smth smth\nsmth smth smth smth."
          }
        />
        <div className="mt-6">
          <SearchInput placeholder="Search competitions" />
        </div>
        <div className="mt-8 grid grid-cols-4 gap-4">
          {competitions.map((comp) => (
            <CompetitionCard
              key={comp.id}
              id={comp.id}
              name={comp.name}
              organiser={comp.organiser}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
