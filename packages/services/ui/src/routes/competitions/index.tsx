import { CompetitionCard } from "*/components/competition-card";
import { PageHeader } from "*/components/page-header";
import { SearchInput } from "*/components/search-input";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk from "sdk";

export const Route = createFileRoute("/competitions/")({
  component: CompetitionsPage,
});

const getCompetitions = createServerFn().handler(async () => {
  const _result = await sdk.competitions.list({});
  // Return mock data for now
  return [
    { id: "gppc-2025", name: "GPPC 2025", organizer: "catalogapp.io" },
    {
      id: "gppc-2024",
      name: "GPPC 2024 (Elapsed)",
      organizer: "catalogapp.io",
    },
    { id: "single-agent-1", name: "Single agent", organizer: "catalogapp.io" },
    { id: "single-agent-2", name: "Single agent", organizer: "catalogapp.io" },
    { id: "single-agent-3", name: "Single agent", organizer: "catalogapp.io" },
    { id: "single-agent-4", name: "Single agent", organizer: "catalogapp.io" },
    ...(_result.value ?? []),
  ];
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
              organizer={comp.organizer}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
