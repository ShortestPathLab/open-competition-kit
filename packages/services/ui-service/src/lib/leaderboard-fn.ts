import { createServerFn } from "@tanstack/react-start";
import sdk, { unsafe, type $props } from "sdk";
import { z } from "zod";

export const getLoadedLeaderboard = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: leaderboardId }) => {
    return (await unsafe(
      sdk.leaderboards.load(leaderboardId),
    )) as typeof $props.leaderboard.ui;
  });
