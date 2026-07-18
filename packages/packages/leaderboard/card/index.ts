import { lazyComponent, type Package } from "@open-competition-kit/sdk";
import card from "./card";

export default {
  name: "@open-competition-kit/leaderboard-card",
  description:
    "Renders Open Competition Kit leaderboard definitions as stat cards, for headline values and top-N summaries.",
  version: "0.0.6",
  leaderboard: { ui: lazyComponent(card) },
} satisfies Package;
