import { makeComponent, type Package } from "@open-competition-kit/sdk";
import { once } from "es-toolkit";
import card from "./card";

export default {
  name: "@open-competition-kit/leaderboard-card",
  description:
    "Renders Open Competition Kit leaderboard definitions as stat cards, for headline values and top-N summaries.",
  version: "0.0.6",
  leaderboard: { ui: once(async () => makeComponent(card)) },
} satisfies Package;
