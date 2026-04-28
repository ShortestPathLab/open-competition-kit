import { SectionHeader } from "*/components/section-header";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/me/settings")({
  component: MeSettingsPage,
});

function MeSettingsPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Settings"
        description="Personal settings will live here."
      />
      <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        Settings are not implemented yet.
      </div>
    </div>
  );
}
