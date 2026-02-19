import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "*/components/navbar";
import { PageHeader } from "*/components/page-header";
import { SearchInput } from "*/components/search-input";
import { CompetitionCard } from "*/components/competition-card";

const competitions = [
  { id: "gppc-2025", name: "GPPC 2025", organizer: "catalogapp.io" },
  { id: "gppc-2024", name: "GPPC 2024 (Elapsed)", organizer: "catalogapp.io" },
  { id: "single-agent-1", name: "Single agent", organizer: "catalogapp.io" },
  { id: "single-agent-2", name: "Single agent", organizer: "catalogapp.io" },
  { id: "single-agent-3", name: "Single agent", organizer: "catalogapp.io" },
  { id: "single-agent-4", name: "Single agent", organizer: "catalogapp.io" },
];

export const Route = createFileRoute("/competitions/")({
  component: CompetitionsPage,
});

function CompetitionsPage() {
  return (
    <div className="min-h-screen">
      <Navbar variant="public" />
      <div className="border-b border-border" />
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
