import { TabNav } from "*/components/tab-nav";

interface CompetitionTabsProps {
  competitionId: string;
}

export function CompetitionTabs({ competitionId }: CompetitionTabsProps) {
  const base = `/competitions/${competitionId}`;
  return (
    <TabNav
      variant="underline"
      tabs={[
        { label: "Overview", href: base, exact: true },
        { label: "Tracks", href: `${base}/tracks` },
        { label: "Rules", href: `${base}/rules` },
        { label: "Submissions", href: `${base}/submissions` },
        { label: "Leaderboard", href: "/leaderboards", badge: 4 },
      ]}
    />
  );
}
