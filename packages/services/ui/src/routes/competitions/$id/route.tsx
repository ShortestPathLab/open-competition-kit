import { CompetitionTabs } from "*/components/competition-tabs";
import { PageHeader } from "*/components/page-header";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk from "sdk";
import { startCase } from "es-toolkit";

export const Route = createFileRoute("/competitions/$id")({
  component: CompetitionLayout,
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

function CompetitionLayout() {
  const { id } = Route.useParams();
  const fetchCompetition = useServerFn(getCompetition);

  const { data: competition } = useQuery({
    queryKey: ["competition", id],
    queryFn: () => (fetchCompetition as any)({ data: id }),
  });

  return (
    <div className="min-h-screen">
      <div className="bg-muted/30 border-b border-border [view-transition-name:competition-header]">
        <div className="mx-auto max-w-5xl px-6 pt-8 pb-0">
          <PageHeader
            title={competition?.name}
            description={competition?.description}
            actions={
              <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
                Participate in this competition
              </button>
            }
          />
          <div className="mt-6">
            <CompetitionTabs competitionId={id} />
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
