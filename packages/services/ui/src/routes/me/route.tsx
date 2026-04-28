import { MeTabs } from "*/components/me-tabs";
import { PageHeader } from "*/components/page-header";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/me")({
  component: MeLayout,
});

function MeLayout() {
  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-muted/30 [view-transition-name:me-header]">
        <div className="mx-auto max-w-5xl px-6 pt-8 pb-0">
          <PageHeader
            title="Me"
            description="Your competition participation and track enrolments."
          />
          <div className="mt-6">
            <MeTabs />
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
