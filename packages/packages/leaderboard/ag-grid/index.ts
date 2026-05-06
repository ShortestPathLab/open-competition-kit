import { makeComponent, type Package } from "sdk";
import leaderboard from "./leaderboard";
import { once } from "es-toolkit";

export default {
  leaderboard: { ui: once(async () => makeComponent(leaderboard)) },
} satisfies Package;
