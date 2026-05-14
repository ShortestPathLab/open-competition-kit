import { createServerFn } from "@tanstack/react-start";
import sdk, { unsafe, type $props } from "sdk";
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
