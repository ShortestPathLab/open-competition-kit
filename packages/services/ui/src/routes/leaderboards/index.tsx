import { PageHeader } from "*/components/page-header";
import { createFileRoute } from "@tanstack/react-router";
import type { $props } from "sdk";
import { useKitComponent } from "src/hooks/use-kit-component";

const leaderboardProps: typeof $props.leaderboard.ui = {
  title: "Active Competition Leaderboard",
  description:
    "Example SDK-provided leaderboard config passed through the UI route.",
  columns: [
    { key: "rank", label: "Rank", kind: "number" },
    { key: "team", label: "Team" },
    { key: "score", label: "Score", kind: "number" },
    { key: "submissions", label: "Submissions", kind: "number" },
    { key: "track", label: "Track" },
    { key: "lastUpdated", label: "Last Updated", kind: "date" },
  ],
  rows: [
    {
      rank: 1,
      team: "Gradient Boosters",
      score: 98.42,
      submissions: 14,
      track: "Vision",
      lastUpdated: "2026-05-06 09:12",
    },
    {
      rank: 2,
      team: "Feature Foundry",
      score: 97.88,
      submissions: 11,
      track: "NLP",
      lastUpdated: "2026-05-06 08:47",
    },
    {
      rank: 3,
      team: "Token Titans",
      score: 97.31,
      submissions: 9,
      track: "Forecasting",
      lastUpdated: "2026-05-06 08:29",
    },
  ],
};

const formProps: typeof $props.form.ui = {
  title: "Competition Registration",
  description: "Example SDK-provided form config passed through the UI route.",
  submitLabel: "Submit registration",
  shape: [
    {
      name: "teamName",
      label: "Team name",
      kind: "text",
      required: true,
      placeholder: "Enter your team name",
    },
    {
      name: "contactEmail",
      label: "Contact email",
      kind: "email",
      required: true,
      placeholder: "team@example.com",
    },
    {
      name: "track",
      label: "Track",
      kind: "select",
      required: true,
      options: [
        { label: "Vision", value: "vision" },
        { label: "NLP", value: "nlp" },
        { label: "Forecasting", value: "forecasting" },
      ],
    },
    {
      name: "acceptRules",
      label: "I agree to the competition rules",
      kind: "checkbox",
      defaultValue: false,
    },
    {
      name: "notes",
      label: "Notes",
      kind: "textarea",
      placeholder: "Share anything the organizers should know",
      lines: 5,
    },
  ],
  data: {
    track: "vision",
  },
};

export const Route = createFileRoute("/leaderboards/")({
  component: LeaderboardsPage,
});

function LeaderboardsPage() {
  const Test = useKitComponent("leaderboard.ui");
  const Test2 = useKitComponent("form.ui");
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader
          title="Leaderboards"
          description="Track the top performing agents across all active competitions."
        />
        <Test {...leaderboardProps} />
        <Test2 {...formProps} />
      </main>
    </div>
  );
}
