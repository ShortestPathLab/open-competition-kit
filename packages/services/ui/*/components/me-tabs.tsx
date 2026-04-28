import { TabNav } from "*/components/tab-nav";

export function MeTabs() {
  return (
    <TabNav
      variant="underline"
      tabs={[
        { label: "Overview", href: "/me" },
        { label: "Submissions", href: "/me/submissions" },
        { label: "Settings", href: "/me/settings" },
      ]}
    />
  );
}
