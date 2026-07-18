import { lazyComponent, type Package } from "@open-competition-kit/sdk";
import chart from "./chart";

export default {
  name: "@open-competition-kit/leaderboard-chart",
  description:
    "Renders Open Competition Kit leaderboard definitions as bar, line, or area charts with Recharts.",
  version: "0.0.6",
  leaderboard: { ui: lazyComponent(chart) },
} satisfies Package;
