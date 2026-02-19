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
        { label: "Overview", href: base },
        { label: "Tracks", href: `${base}/tracks` },
        { label: "Rules", href: `${base}/rules` },
        { label: "Leaderboard", href: `${base}/leaderboard`, badge: 4 },
        { label: "My submissions", href: `${base}/submissions` },
      ]}
    />
  );
}
