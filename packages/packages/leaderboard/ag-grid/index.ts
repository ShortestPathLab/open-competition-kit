import { makeComponent, type Package } from "@open-competition-kit/sdk";
import leaderboard from "./leaderboard";
import { once } from "es-toolkit";

export default {
  name: "@open-competition-kit/leaderboard-ag-grid",
  description:
    "Renders Open Competition Kit leaderboard definitions as sortable, filterable AG Grid tables.",
  version: "0.0.6",
  leaderboard: { ui: once(async () => makeComponent(leaderboard)) },
} satisfies Package;
