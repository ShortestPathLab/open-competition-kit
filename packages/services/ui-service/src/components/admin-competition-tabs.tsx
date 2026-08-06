import { TabNav } from "@/components/tab-nav";

interface AdminCompetitionTabsProps {
  competitionId: string;
}

/**
 * The four sections of one competition's dashboard.
 *
 * No counts on the tabs. The one that was there read "4k" on every deployment
 * whatever the real number was, and the honest version costs the whole activity
 * read on pages that do not otherwise need it, including settings.
 */
export function AdminCompetitionTabs({ competitionId }: AdminCompetitionTabsProps) {
  const base = `/dashboard/${competitionId}`;
  return (
    <TabNav
      tabs={[
        { label: "Overview", href: `${base}/overview` },
        { label: "Participants", href: `${base}/participants` },
        { label: "Submissions", href: `${base}/submissions` },
        { label: "Settings", href: `${base}/settings` },
      ]}
    />
  );
}
