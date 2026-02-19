import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/competitions/$id/")({
  component: CompetitionOverviewPage,
});

function CompetitionOverviewPage() {
  return (
    <div>
      <p className="text-muted-foreground">
        Competition overview content goes here.
      </p>
    </div>
  );
}
