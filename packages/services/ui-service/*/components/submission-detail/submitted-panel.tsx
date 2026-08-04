import { Panel, PanelBody, PanelHeader, PanelTitle } from "*/components/panel";
import { ValueTree } from "*/components/value-tree";
import { Button } from "*/components/ui/button";
import { cn } from "*/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Download } from "lucide-react";
import { formatBytes, type readBody } from "src/lib/submission-readout";
import { RawDisclosure } from "./parts";

/** The entrant's own answers, as they were sent. */
export function SubmittedPanel({
  body,
  raw,
}: {
  body: ReturnType<typeof readBody>;
  raw: unknown;
}) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>What you submitted</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-4">
        {body.fields.map((field) => (
          <div key={field.key} className="min-w-0">
            {/* A body that is a single unnamed answer has nothing to put here,
                and the panel's own heading already names it. */}
            {field.label ?
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {field.label}
              </p>
            : null}
            {field.file ?
              <div className="mt-1.5 flex items-center gap-3 rounded-lg border border-border bg-muted px-3 py-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand-subtle font-mono text-[10px] font-bold text-primary">
                  FILE
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {field.file.name}
                  </span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {formatBytes(field.file.size)}
                  </span>
                </span>
                {/* TODO(files): needs a route that resolves a FileRef to a signed
                    URL for whoever owns it. */}
                <Button variant="ghost" size="sm" className="ml-auto" disabled>
                  <Download className="size-3.5" />
                </Button>
              </div>
            : <ValueTree
                className={cn(field.label && "mt-1")}
                value={field.value}
              />
            }
          </div>
        ))}
      </PanelBody>
      <RawDisclosure label="Raw submission body" value={raw} />
    </Panel>
  );
}

/**
 * Where else this submission lives.
 *
 * TODO(standings): the mockup also shows this submission's rank and the leader's
 * score. Both need a leaderboard read keyed by submission, which
 * `getCompetitionStandings` does not do.
 */
export function TrackLinksPanel({
  competitionId,
  trackId,
}: {
  competitionId: string;
  trackId: string;
}) {
  const row =
    "flex items-center justify-between gap-3 px-5 py-3 text-sm font-medium hover:bg-muted";

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Track</PanelTitle>
      </PanelHeader>
      <div className="flex flex-col">
        <Link
          to="/competitions/$id/tracks/$trackId"
          params={{ id: competitionId, trackId }}
          className={row}
        >
          Open track
          <ArrowUpRight className="size-4 text-muted-foreground" />
        </Link>
        <Link
          to="/competitions/$id/leaderboards"
          params={{ id: competitionId }}
          className={cn(row, "border-t border-border")}
        >
          Leaderboards
          <ArrowUpRight className="size-4 text-muted-foreground" />
        </Link>
        <Link
          to="/competitions/$id/submissions"
          params={{ id: competitionId }}
          className={cn(row, "border-t border-border")}
        >
          Your submissions here
          <ArrowUpRight className="size-4 text-muted-foreground" />
        </Link>
      </div>
    </Panel>
  );
}
