import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk from "sdk";
import { PageHeader } from "*/components/page-header";
import { startCase } from "es-toolkit";

export const Route = createFileRoute("/competitions/$id/")({
  component: CompetitionOverviewPage,
});

const getCompetition = createServerFn({ method: "GET" }).handler(
  async (ctx: any) => {
    const id = ctx.data as string;
    const _result = await sdk.competitions.get(id);
    // Return mock data for now
    return {
      id,
      name: startCase(id),
      organizer: "catalogapp.io",
      description: "A detailed description of the competition " + id,
    };
  },
);

function CompetitionOverviewPage() {
  const { id } = Route.useParams();
  const fetchCompetition = useServerFn(getCompetition);

  const { data: competition } = useQuery({
    queryKey: ["competition", id],
    queryFn: () => (fetchCompetition as any)({ data: id }),
  });

  if (!competition) return <div>Loading...</div>;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={competition.name}
        description={competition.description}
      />
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Competition Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Organizer</p>
            <p>{competition.organizer}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Competition ID</p>
            <p className="font-mono text-sm">{competition.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
