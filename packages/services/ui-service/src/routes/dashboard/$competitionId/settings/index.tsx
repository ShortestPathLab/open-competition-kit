import { createFileRoute } from "@tanstack/react-router";
import { Info, SearchX, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { QueryFailure } from "@/components/dashboard/parts";
import { RestartPrompt } from "@/components/dashboard/restart-prompt";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { PageBody } from "@/components/page-header-band";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/panel";
import { SectionHeader } from "@/components/section-header";
import { PageSkeleton } from "@/components/skeletons";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  useCompetitionConfig,
  useConfigWritability,
  useSetCompetitionConfig,
} from "@/lib/dashboard-config-fn";
import { cn } from "@/lib/utils";
import { queryClient } from "@/router";

export const Route = createFileRoute("/dashboard/$competitionId/settings/")({
  component: SettingsPage,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 px-5 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

/**
 * The competition's settings, in two halves.
 *
 * Editable at the top: what the competition is called and how it reads, plus
 * every field the installed packages declare, which is what its behaviour turns
 * on. Read-only underneath: what the competition is made of. Tracks,
 * leaderboards and the package list are structure rather than settings, and a
 * form that offered to add a leaderboard would be a config file editor with
 * worse ergonomics than the config file.
 *
 * Saving writes the config file itself. The banner above the form says so before
 * anybody types, because that file is usually in a git repository and somebody
 * else's next `git pull` is where this shows up.
 */
function SettingsPage() {
  const { competitionId } = Route.useParams();
  const { data: config, isLoading, isError, error } = useCompetitionConfig(competitionId);
  const { data: writable } = useConfigWritability();
  const save = useSetCompetitionConfig();
  // Opened when a save lands, and again from the saved panel, since a change
  // sitting in a file that nothing has read yet is easy to walk away from.
  const [asking, setAsking] = useState(false);

  if (isLoading) return <PageSkeleton />;

  // A failed read and a missing competition are told apart. They used to share
  // this branch, so a server function that threw reported the competition as
  // absent from the config it was plainly in.
  if (isError || !config) {
    return (
      <>
        <AdminPageHeader competitionId={competitionId} title="Settings" tabs />
        <PageBody>
          {isError ? (
            <QueryFailure error={error} />
          ) : (
            <Empty className="rounded-2xl border border-dashed border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchX />
                </EmptyMedia>
                <EmptyTitle>Competition not found</EmptyTitle>
                <EmptyDescription>
                  No competition with id <code className="font-mono">{competitionId}</code> exists
                  in the config.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </PageBody>
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        competitionId={competitionId}
        competitionName={config.name}
        title="Settings"
        description="What you can change about this competition without editing the config file by hand."
        tabs
      />

      <PageBody className="flex flex-col gap-10">
        <section className="flex flex-col gap-4">
          <SectionHeader
            title="Settings"
            description="What this competition is called and how it reads, then every field the installed packages declare here, with their own labels and help text."
          />

          {/* Where a change goes, said before anybody makes one. A settings page
              that writes a file the reader has never heard of is a settings page
              they cannot check, and this one is usually in a git repository. */}
          <div
            className={cn(
              "flex items-start gap-2 rounded-lg border px-4 py-3 text-sm",
              writable?.writable === false
                ? "border-warning/40 bg-warning/8 text-foreground"
                : "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            {writable?.writable === false ? (
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0" />
            )}
            <span>
              {writable?.writable === false ? (
                <>
                  {writable.detail} Changes here can still be checked, and the lines to paste come
                  back with the answer.
                </>
              ) : (
                <>
                  Changes are saved to <code className="font-mono text-xs">{config.file}</code>,
                  with its comments and layout left as they are. Both services read that file when
                  they start, so a change applies after a restart.
                </>
              )}
            </span>
          </div>

          <SettingsForm
            settings={config.settings}
            canStore={writable?.writable ?? false}
            saving={save.isPending}
            result={save.data}
            onRestart={() => setAsking(true)}
            onSave={(edits) =>
              save.mutate(edits, {
                onSuccess: (result) => {
                  // Only when something actually changed on disk. A check that
                  // was not stored leaves the config exactly as this page has
                  // it, and refetching would only throw away the draft.
                  if (!result.stored) return;
                  void queryClient.invalidateQueries({
                    queryKey: ["competitionConfig", competitionId],
                  });
                  setAsking(true);
                },
              })
            }
          />

          {save.isError ? (
            <p className="text-sm text-destructive">
              The save could not run: {(save.error as Error).message}
            </p>
          ) : null}

          <RestartPrompt open={asking} onDismiss={() => setAsking(false)} />
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader
            title="What this competition is made of"
            description="Structure rather than settings. Adding a track or a board means editing the config file, where a list can say where its entries come from."
          />

          <Panel>
            <PanelHeader>
              <PanelTitle>Identity</PanelTitle>
            </PanelHeader>
            <div className="divide-y divide-border">
              <Row
                label="Competition ID"
                value={<code className="font-mono text-xs">{config.id}</code>}
              />
              <Row label="Database" value={config.database.provider} />
            </div>
            <PanelBody className="border-t border-border pt-3 text-xs text-muted-foreground">
              {/* The one field above that looks editable and is not. Every
                  enrolment, submission and job row points at this id, and
                  renaming it here would rename none of them. */}
              The id is not editable. Every entry and submission in the database points at it, so
              changing it here would read as a rename and land as a disappearance.
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Tracks</PanelTitle>
              <span className="text-xs text-muted-foreground">
                Each track has its own submission form. Names and rules are editable above.
              </span>
            </PanelHeader>
            <div className="divide-y divide-border">
              {config.tracks.length ? (
                config.tracks.map((track) => (
                  <Row
                    key={track.id}
                    label={track.name}
                    value={`${track.fields} form field${track.fields === 1 ? "" : "s"}`}
                  />
                ))
              ) : (
                <Row label="No tracks configured" value="Nothing can be submitted yet" />
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Leaderboards</PanelTitle>
              <span className="text-xs text-muted-foreground">Where each board's rows come from.</span>
            </PanelHeader>
            <div className="divide-y divide-border">
              {config.leaderboards.length ? (
                config.leaderboards.map((leaderboard) => (
                  <Row
                    key={leaderboard.id}
                    label={leaderboard.name}
                    value={<code className="font-mono text-xs">{leaderboard.source}</code>}
                  />
                ))
              ) : (
                <Row label="No leaderboards configured" value="Nothing is being ranked" />
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Packages</PanelTitle>
              <span className="text-xs text-muted-foreground">
                The implementations this competition is composed of.
              </span>
            </PanelHeader>
            <div className="flex flex-wrap gap-2 p-5">
              {config.packages.length ? (
                config.packages.map((pkg) => (
                  <code
                    key={pkg}
                    className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs"
                  >
                    {pkg}
                  </code>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">None</span>
              )}
            </div>
          </Panel>
        </section>
      </PageBody>
    </>
  );
}
