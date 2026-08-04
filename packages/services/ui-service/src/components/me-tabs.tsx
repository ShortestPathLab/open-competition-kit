import { TabNav } from "@/components/tab-nav";

export function MeTabs() {
  return (
    <TabNav
      variant="pill"
      tabs={[
        { label: "Overview", href: "/me", exact: true },
        { label: "Enrolments", href: "/me/enrolments" },
        { label: "Submissions", href: "/me/submissions" },
        { label: "Settings", href: "/me/settings" },
      ]}
    />
  );
}
