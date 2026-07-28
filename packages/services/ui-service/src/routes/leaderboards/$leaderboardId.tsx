import { PageHeaderBand } from "*/components/page-header-band";
import { Panel, PanelBody } from "*/components/panel";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "*/components/ui/breadcrumb";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "*/components/ui/empty";
import { Trophy } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "*/components/ui/select";
import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { useKitComponent } from "src/hooks/use-kit-component";
import { getLeaderboards, getLoadedLeaderboard } from "src/lib/leaderboard-fn";

export const Route = createFileRoute("/leaderboards/$leaderboardId")({
  component: LeaderboardPage,
  loader: async ({ params }) => {
    const leaderboards = await getLeaderboards();
    const selectedLeaderboard =
      leaderboards.find(
        (leaderboard) => leaderboard.id === params.leaderboardId,
      ) ?? leaderboards[0];

    if (!selectedLeaderboard) {
      return { leaderboards, selectedLeaderboard: null, leaderboardDef: null };
    }

    if (selectedLeaderboard.id !== params.leaderboardId) {
      throw redirect({
        to: "/leaderboards/$leaderboardId",
        params: { leaderboardId: selectedLeaderboard.id },
      });
    }

    const leaderboardDef = await getLoadedLeaderboard({
      data: selectedLeaderboard.id,
    });

    return { leaderboards, selectedLeaderboard, leaderboardDef };
  },
});

function LeaderboardPage() {
  const router = useRouter();
  const { leaderboards, selectedLeaderboard, leaderboardDef } =
    Route.useLoaderData();

  // Resolve the renderer against *this* leaderboard, not the root config: a
  // board's own `with:` is applied last and so overrides the inherited default,
  // which is what lets one competition mix a table, cards, and a chart.
  const Leaderboard = useKitComponent(
    "leaderboard.ui",
    selectedLeaderboard ?
      { competitions: { leaderboards: selectedLeaderboard.id } }
    : undefined,
  );

  return (
    <div className="min-h-screen">
      <PageHeaderBand
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link to="/competitions" />}>
                  Competitions
                </BreadcrumbLink>
              </BreadcrumbItem>
              {selectedLeaderboard ? (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      render={
                        <Link
                          to="/competitions/$id"
                          params={{ id: selectedLeaderboard.competitionId }}
                        />
                      }
                    >
                      {selectedLeaderboard.competitionName}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </>
              ) : null}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Leaderboards</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        title="Leaderboards"
        description={
          selectedLeaderboard ?
            "Public standings, built from evaluated submissions."
          : "Standings across active competitions."
        }
        actions={
          selectedLeaderboard ? (
            <Select
              items={leaderboards.map((leaderboard) => ({
                label: leaderboard.name,
                value: leaderboard.id,
              }))}
              value={selectedLeaderboard.id}
              onValueChange={(leaderboardId) => {
                if (!leaderboardId) return;
                router.navigate({
                  to: "/leaderboards/$leaderboardId",
                  params: { leaderboardId },
                });
              }}
            >
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Choose a leaderboard" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  <SelectLabel>Leaderboards</SelectLabel>
                  {leaderboards.map((leaderboard) => (
                    <SelectItem key={leaderboard.id} value={leaderboard.id}>
                      {leaderboard.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null
        }
      />
      <main className="mx-auto max-w-7xl px-6 py-8">
        {selectedLeaderboard && leaderboardDef ? (
          <Panel>
            <PanelBody>
              <Leaderboard def={leaderboardDef} />
            </PanelBody>
          </Panel>
        ) : (
          <Empty className="rounded-2xl border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>No leaderboards yet</EmptyTitle>
              <EmptyDescription>
                No leaderboards have been configured for this competition yet.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </main>
    </div>
  );
}
