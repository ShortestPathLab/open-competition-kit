import { TabNav } from "*/components/tab-nav";

interface AdminCompetitionTabsProps {
  competitionId: string;
}

export function AdminCompetitionTabs({
  competitionId,
}: AdminCompetitionTabsProps) {
  const base = `/dashboard/${competitionId}`;
  return (
    <TabNav
      tabs={[
        { label: "Overview", href: `${base}/overview` },
        { label: "Participants", href: `${base}/participants` },
        { label: "Submissions", href: `${base}/submissions`, badge: "4k" },
        { label: "Configure", href: `${base}/configure` },
      ]}
    />
  );
}
