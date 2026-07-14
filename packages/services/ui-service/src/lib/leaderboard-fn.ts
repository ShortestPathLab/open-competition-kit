import { createServerFn, useServerFn } from "@tanstack/react-start";
import { skipToken, useQuery } from "@tanstack/react-query";
import sdk, { unsafe, type $props } from "@open-competition-kit/sdk";
import { z } from "zod";

export type LeaderboardSummary = {
  id: string;
  name: string;
  description?: string;
  competitionId: string;
  competitionName: string;
};

export const getLeaderboards = createServerFn({ method: "GET" }).handler(
  async (): Promise<LeaderboardSummary[]> => {
    const config = await unsafe(sdk.config.get());

    return config.competitions.flatMap((competition) =>
      competition.leaderboards.map((leaderboard) => ({
        id: leaderboard.id,
        name: leaderboard.name ?? leaderboard.label ?? leaderboard.id,
        description: leaderboard.description,
        competitionId: competition.id,
        competitionName: competition.name ?? competition.id,
      })),
    );
  },
);

export const getLoadedLeaderboard = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: leaderboardId }) => {
    return (await unsafe(
      sdk.leaderboards.load(leaderboardId),
    )) as (typeof $props.leaderboard.ui)["def"];
  });

const getCompetitionLeaderboards = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: competitionId }): Promise<LeaderboardSummary[]> => {
    const config = await unsafe(sdk.config.get());
    const competition = config.competitions.find((c) => c.id === competitionId);
    if (!competition) return [];

    return competition.leaderboards.map((leaderboard) => ({
      id: leaderboard.id,
      name: leaderboard.name ?? leaderboard.label ?? leaderboard.id,
      description: leaderboard.description,
      competitionId: competition.id,
      competitionName: competition.name ?? competition.id,
    }));
  });

export function useCompetitionLeaderboards(competitionId?: string) {
  const fetch = useServerFn(getCompetitionLeaderboards);
  return useQuery({
    queryKey: ["competition-leaderboards", competitionId],
    queryFn:
      competitionId ? () => fetch({ data: competitionId }) : skipToken,
  });
}
