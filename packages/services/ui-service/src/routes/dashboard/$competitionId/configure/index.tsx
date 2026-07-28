import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "*/components/ui/empty";
import { PageSkeleton } from "*/components/skeletons";
import { SectionHeader } from "*/components/section-header";
import { ensureAdmin } from "src/lib/admin";
import { Info, SearchX } from "lucide-react";
import { z } from "zod";

/**
 * Reports the competition's *actual* configuration.
 *
 * This page is read-only on purpose. The config is the source of truth and lives
 * in `competition.config.yaml`; core has no writer, so an editable form here
 * would either lie about saving or need a write path that doesn't exist yet.
 * Showing the real values beats showing invented ones.
 */
const getCompetitionConfig = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    await ensureAdmin();

    const config = await unsafe(sdk.config.get());
    const competition = config.competitions.find((c) => c.id === id);
    if (!competition) return null;

    const db = config.db as { provider?: string; url?: string };

    return {
      id: competition.id,
      name: competition.name ?? competition.id,
      organiser: competition.organiser ?? "-",
      description: competition.description ?? "-",
      tracks: competition.tracks.map((t) => ({
        id: t.id,
        name: t.name ?? t.id,
        fields: t.form.shape.length,
      })),
      leaderboards: competition.leaderboards.map((l) => ({
        id: l.id,
        name: l.name ?? l.id,
        source: l.from ? (l.from.output ?? "default") : "static items",
      })),
      packages: [...competition.with],
      database: {
        provider: db?.provider ?? "-",
        // Never surface the connection string: it carries credentials.
        configured: Boolean(db?.url),
      },
    };
  });

export const Route = createFileRoute("/dashboard/$competitionId/configure/")({
  component: ConfigurePage,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-border py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function ConfigurePage() {
  const { competitionId } = Route.useParams();
  const fetchConfig = useServerFn(getCompetitionConfig);

  const { data: config, isLoading } = useQuery({
    queryKey: ["competitionConfig", competitionId],
    queryFn: () => fetchConfig({ data: competitionId }),
  });

  if (isLoading) return <PageSkeleton />;
  if (!config) {
    return (
      <Empty className="rounded-lg border border-dashed border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>Competition not found</EmptyTitle>
          <EmptyDescription>
            No competition with id{" "}
            <code className="font-mono">{competitionId}</code> exists in the
            config.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionHeader
          title="Competition settings"
          description="The live configuration for this competition."
        />

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Read-only. These values come from{" "}
            <code className="font-mono text-xs">competition.config.yaml</code>;
            edit that file and restart to change them.
          </span>
        </div>

        <div className="mt-4 rounded-lg border border-border px-4">
          <Row label="Name" value={config.name} />
          <Row
            label="Competition ID"
            value={<code className="font-mono text-xs">{config.id}</code>}
          />
          <Row label="Organiser" value={config.organiser} />
          <Row label="Database" value={config.database.provider} />
          <Row
            label="Database URL"
            value={
              config.database.configured ?
                <span className="text-success">Configured</span>
              : <span className="text-destructive">Missing</span>
            }
          />
        </div>
      </section>

      <section>
        <SectionHeader
          title="Tracks"
          description="Each track has its own submission form."
        />
        <div className="mt-4 rounded-lg border border-border px-4">
          {config.tracks.length ?
            config.tracks.map((track) => (
              <Row
                key={track.id}
                label={track.name}
                value={`${track.fields} form field${track.fields === 1 ? "" : "s"}`}
              />
            ))
          : <Row label="No tracks configured" value="-" />}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Leaderboards"
          description="Where each board's rows come from."
        />
        <div className="mt-4 rounded-lg border border-border px-4">
          {config.leaderboards.length ?
            config.leaderboards.map((leaderboard) => (
              <Row
                key={leaderboard.id}
                label={leaderboard.name}
                value={
                  <code className="font-mono text-xs">{leaderboard.source}</code>
                }
              />
            ))
          : <Row label="No leaderboards configured" value="-" />}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Packages"
          description="The implementations this competition is composed of."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {config.packages.length ?
            config.packages.map((pkg) => (
              <code
                key={pkg}
                className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs"
              >
                {pkg}
              </code>
            ))
          : <span className="text-sm text-muted-foreground">None</span>}
        </div>
      </section>
    </div>
  );
}
