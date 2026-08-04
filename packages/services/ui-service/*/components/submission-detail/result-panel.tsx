import { Panel, PanelBody, PanelHeader, PanelTitle } from "*/components/panel";
import { ValueTree } from "*/components/value-tree";
import type { SubmissionJob } from "src/lib/submission-fn";
import {
  formatResultValue,
  formatScore,
  type ResultReadout,
} from "src/lib/submission-readout";
import { LogConsole, RawDisclosure } from "./parts";

/** What the selected run produced, or why there is nothing to show. */
export function ResultPanel({
  job,
  readout,
  runNumber,
}: {
  job?: SubmissionJob;
  readout: ResultReadout;
  runNumber: number;
}) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{job ? `Result from run ${runNumber}` : "Result"}</PanelTitle>
        <span className="font-mono text-xs text-muted-foreground">
          tag/output/default
        </span>
      </PanelHeader>
      {!job || !readout.present ?
        <PanelBody className="py-8 text-center">
          <p className="text-sm font-medium">
            {job ? "This run produced no result" : "No run selected"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {job ?
              "It stopped before the suite wrote an output. The logs below have the reason."
            : "Pick a run above to read what it produced."}
          </p>
        </PanelBody>
      : <>
          {readout.meta.length > 0 ?
            <div className="flex flex-wrap gap-2 px-5 pt-4">
              {readout.meta.map((entry) => (
                <span
                  key={entry.key}
                  className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {entry.label}{" "}
                  <b className="font-mono font-semibold text-foreground">
                    {formatResultValue(entry.value)}
                  </b>
                </span>
              ))}
            </div>
          : null}

          <PanelBody className="p-2">
            {readout.scores.map((score) => (
              <div
                key={score.key}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2.5 last:border-b-0"
              >
                <span className="text-sm">{score.label}</span>
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {formatScore(score.value)}
                </span>
                {/* A bar only where one is honest: a score outside 0 to 1 has no
                    stated ceiling to draw against. */}
                {score.value >= 0 && score.value <= 1 ?
                  <span className="col-span-2 h-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full bg-primary/60"
                      style={{ width: `${score.value * 100}%` }}
                    />
                  </span>
                : null}
              </div>
            ))}
            {readout.headline ?
              <div className="mt-1 flex items-center justify-between gap-4 rounded-lg bg-muted px-3 py-2.5">
                <span className="text-sm font-semibold">
                  {readout.headline.label}
                </span>
                <span className="font-mono text-lg font-semibold text-primary tabular-nums">
                  {formatScore(readout.headline.value)}
                </span>
              </div>
            : null}
            {readout.nested.map((entry) => (
              <div key={entry.key} className="px-3 py-2.5">
                <p className="text-sm font-medium">{entry.label}</p>
                <ValueTree className="mt-2" value={entry.value} />
              </div>
            ))}
          </PanelBody>
          <RawDisclosure label="Raw output value" value={job.result} />
        </>
      }
    </Panel>
  );
}

export function LogsPanel({ job }: { job?: SubmissionJob }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Logs</PanelTitle>
        <span className="font-mono text-xs text-muted-foreground">
          {job?.logs.length ? `${job.logs.length} lines` : "tag/logs"}
        </span>
      </PanelHeader>
      {job?.logs.length ?
        <LogConsole lines={job.logs} />
      : <PanelBody className="py-8 text-center">
          <p className="text-sm font-medium">No logs for this run</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The runner for this track does not write log lines yet.
          </p>
        </PanelBody>
      }
    </Panel>
  );
}

/** Anything the run wrote beyond the default output reference. */
export function OtherOutputsPanel({ job }: { job: SubmissionJob }) {
  if (!job.outputs.length) return null;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Other outputs</PanelTitle>
        <span className="font-mono text-xs text-muted-foreground">
          {job.outputs.length}
        </span>
      </PanelHeader>
      <PanelBody className="space-y-3">
        {job.outputs.map((output) => (
          <div key={output.id} className="rounded-lg border border-border p-4">
            <p className="font-mono text-xs text-muted-foreground">
              {output.reference}
            </p>
            <ValueTree className="mt-2" value={output.value} />
          </div>
        ))}
      </PanelBody>
    </Panel>
  );
}
