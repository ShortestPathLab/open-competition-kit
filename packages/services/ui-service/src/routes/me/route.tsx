import { MeTabs } from "*/components/me-tabs";
import { PageHeaderBand } from "*/components/page-header-band";
import { Button } from "*/components/ui/button";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/me")({ component: MeLayout });

function MeLayout() {
  return (
    <div className="min-h-screen">
      <PageHeaderBand
        className="[view-transition-name:me-header]"
        title="Your competitions"
        description="Everything you have entered, in one place."
        actions={
          <Button variant="outline" render={<Link to="/competitions" />}>
            Browse competitions
            <ArrowRight />
          </Button>
        }
      >
        <MeTabs />
      </PageHeaderBand>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
