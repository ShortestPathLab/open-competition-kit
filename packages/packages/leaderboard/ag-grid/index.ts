import { lazyComponent, type Package } from "@open-competition-kit/sdk";
import leaderboard from "./leaderboard";

export default {
  name: "@open-competition-kit/leaderboard-ag-grid",
  description:
    "Renders Open Competition Kit leaderboard definitions as sortable, filterable AG Grid tables.",
  version: "0.0.6",
  leaderboard: { ui: lazyComponent(leaderboard) },
} satisfies Package;
