import { StatusPill, type PillTone } from "*/components/status-pill";
import { cn } from "*/lib/utils";
import { CalendarClock, CircleCheck, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { isActionable, phaseOf, type Phase } from "src/lib/competition-window";
import {
  describeDuration,
  formatInstant,
} from "@open-competition-kit/sdk/instant";
import { nextInstant, type GateReport } from "@open-competition-kit/sdk/gate";

/**
 * What the installed gates say about a track, drawn in the product's own design.
 *
 * Nothing here knows what a deadline, an attempt ceiling or a rate limit is. A
 * package reports a state, a label and sometimes an instant, and this turns those
 * into a pill, a countdown and a sentence. A package that adds a rule next year
 * gets all three without shipping a component.
 *
 * Advisory throughout. The server decides whether a submission is accepted, so
 * this being briefly stale on a slow cache costs a confusing moment and nothing
 * else.
 */

/**
 * Re-renders on a timer so a track that closes while somebody is staring at the
 * page actually closes on screen. Half a minute is close enough for a deadline
 * measured in weeks, and cheap enough to leave running.
 *
 * Only the phase is recomputed, not the reports themselves: those come from the
 * server and are refetched on their own schedule.
 */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** The live phase of a track, from what its gates last reported. */
export function usePhase(reports: readonly GateReport[]): Phase {
  return phaseOf(reports, useNow());
}

const PHASE_TONES: Record<Phase, PillTone> = {
  open: "success",
  closing: "pending",
  upcoming: "unknown",
  closed: "unknown",
};

const PHASE_LABELS: Record<Phase, string> = {
  open: "Open",
  closing: "Closes soon",
  upcoming: "Upcoming",
  closed: "Closed",
};

const PHASE_ICONS = {
  open: CircleCheck,
  closing: CalendarClock,
  upcoming: CalendarClock,
  closed: LockKeyhole,
} as const;

/**
 * The label for a phase, preferring what the gate itself said.
 *
 * A package that reports "No attempts left" has written something better than
 * "Closed", and there is no reason for the product to overrule it. The generic
 * word is the fallback for a track nothing had anything to say about.
 */
function labelFor(reports: readonly GateReport[], phase: Phase) {
  const deciding = reports.find(
    (report) =>
      (phase === "open" && report.state === "ok") ||
      (phase === "closing" && report.state === "pending") ||
      ((phase === "upcoming" || phase === "closed") &&
        report.state === "blocked"),
  );
  return deciding?.label ?? PHASE_LABELS[phase];
}

export function SubmissionWindowBadge({
  reports,
}: {
  reports: readonly GateReport[];
}) {
  const phase = usePhase(reports);
  const Icon = PHASE_ICONS[phase];

  return (
    <StatusPill tone={PHASE_TONES[phase]} pulse={phase === "closing"}>
      <Icon className="size-3" />
      {labelFor(reports, phase)}
    </StatusPill>
  );
}

/**
 * A track's status in the space a list column has: a pill, how far away whatever
 * happens next is, and the instant itself underneath in the reader's timezone.
 */
export function WindowStatus({
  reports,
  className,
}: {
  reports: readonly GateReport[];
  className?: string;
}) {
  const now = useNow();
  const phase = phaseOf(reports, now);
  const next = nextInstant(reports, now);

  const summary =
    next?.at ?
      `${(next.atLabel ?? "next").toLowerCase()} in ${describeDuration(Date.parse(next.at) - now)}`
    : phase === "closed" ? "no longer accepting submissions"
    : "no closing date";

  return (
    <div className={cn("min-w-0", className)}>
      <StatusPill tone={PHASE_TONES[phase]} pulse={phase === "closing"}>
        {labelFor(reports, phase)}
      </StatusPill>
      <p className="mt-1.5 text-xs text-muted-foreground">{summary}</p>
      {next?.at ?
        <time
          dateTime={next.at}
          className="mt-0.5 block font-mono text-[11px] text-muted-foreground/80"
        >
          {formatInstant(next.at)}
        </time>
      : null}
    </div>
  );
}

const STATE_TONES: Record<GateReport["state"], PillTone> = {
  ok: "success",
  pending: "pending",
  blocked: "destructive",
};

/**
 * Every gate's answer, spelled out, for somewhere with room to say it.
 *
 * One row per report rather than a single summary, because the reports are about
 * different things: a track can be open and still have one attempt left, and a
 * competitor needs both facts. Renders nothing when no gate has anything to say,
 * so a track with no rules does not grow an empty panel.
 */
export function SubmissionWindowSummary({
  reports,
}: {
  reports: readonly GateReport[];
}) {
  if (!reports.length) return null;

  return (
    <div className="flex flex-col gap-2 text-sm">
      {reports.map((report) => (
        <div
          key={report.gate}
          className="flex flex-wrap items-center gap-x-3 gap-y-1"
        >
          <StatusPill tone={STATE_TONES[report.state]}>
            {report.label}
          </StatusPill>
          {report.detail ?
            <span className="text-muted-foreground">{report.detail}</span>
          : null}
        </div>
      ))}
    </div>
  );
}

export { isActionable, phaseOf, type Phase };
