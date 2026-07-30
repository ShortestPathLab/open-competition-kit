import { StatusPill, type PillTone } from "*/components/status-pill";
import { Badge } from "*/components/ui/badge";
import { cn } from "*/lib/utils";
import { CalendarClock, CircleCheck, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { describeDuration } from "src/lib/competition-window";
import {
  formatInstant,
  windowStateAt,
  type SubmissionWindow,
  type WindowState,
} from "@open-competition-kit/sdk/window";

/**
 * Re-renders on a timer so a window that closes while somebody is staring at the
 * page actually closes on screen. Half a minute is close enough for a deadline
 * measured in weeks, and cheap enough to leave running.
 */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * The live state of a track's window.
 *
 * Advisory only. The server decides whether a submission is accepted, so this
 * being briefly wrong on a skewed clock costs nothing but a confusing moment.
 */
export function useWindowState(window: SubmissionWindow): WindowState {
  return windowStateAt(window, useNow());
}

export function SubmissionWindowBadge({ state }: { state: WindowState }) {
  switch (state.status) {
    case "upcoming":
      return (
        <Badge variant="secondary">
          <CalendarClock />
          Opens {formatInstant(state.opensAt)}
        </Badge>
      );
    case "closed":
      return (
        <Badge variant="destructive">
          <LockKeyhole />
          Closed {formatInstant(state.closesAt)}
        </Badge>
      );
    case "open":
      return (
        <Badge variant="outline">
          <CircleCheck />
          Open for submissions
        </Badge>
      );
  }
}

/** Inside this much of the deadline, a track reads as closing rather than open. */
export const CLOSING_SOON_MS = 3 * 24 * 60 * 60 * 1000;

export type WindowPhase = "open" | "closing" | "upcoming" | "closed";

/**
 * The window as one word, which is what a list can sort and section by.
 *
 * "Closing" is not a state the kit has: a window is open until it is not. It
 * exists here because a track with two days left and a track with two months
 * left are otherwise the same colour, and only one of them needs you today.
 *
 * Takes the window as well as its state because `WindowState` carries only the
 * bound that decided it, and an open window's `closesAt` is the one this needs.
 */
export function phaseOf(
  window: SubmissionWindow,
  state: WindowState,
  now = Date.now(),
): WindowPhase {
  if (state.status === "upcoming") return "upcoming";
  if (state.status === "closed") return "closed";
  if (window.closesAt && Date.parse(window.closesAt) - now <= CLOSING_SOON_MS) {
    return "closing";
  }
  return "open";
}

const PHASE_TONES: Record<WindowPhase, PillTone> = {
  open: "success",
  closing: "pending",
  upcoming: "unknown",
  closed: "unknown",
};

const PHASE_LABELS: Record<WindowPhase, string> = {
  open: "Open",
  closing: "Closes soon",
  upcoming: "Upcoming",
  closed: "Closed",
};

/**
 * A track's window in the space a list column has: a pill, how far away the
 * next bound is, and the instant itself underneath in the reader's timezone.
 *
 * A track with neither bound has always been open and always will be, so it
 * says so rather than counting down to nothing.
 */
export function WindowStatus({
  window,
  className,
}: {
  window: SubmissionWindow;
  className?: string;
}) {
  const state = useWindowState(window);
  const now = Date.now();
  const phase = phaseOf(window, state, now);

  const bound = phase === "upcoming" ? window.opensAt : window.closesAt;

  const distance =
    bound && phase !== "closed" ?
      describeDuration(Math.abs(Date.parse(bound) - now))
    : undefined;

  const summary =
    phase === "upcoming" && distance ? `opens in ${distance}`
    : phase === "closed" ? "no longer accepting submissions"
    : distance ? `closes in ${distance}`
    : "no closing date";

  return (
    <div className={cn("min-w-0", className)}>
      <StatusPill tone={PHASE_TONES[phase]} pulse={phase === "closing"}>
        {PHASE_LABELS[phase]}
      </StatusPill>
      <p className="mt-1.5 text-xs text-muted-foreground">{summary}</p>
      {bound ? (
        <time
          dateTime={bound}
          className="mt-0.5 block font-mono text-[11px] text-muted-foreground/80"
        >
          {formatInstant(bound)}
        </time>
      ) : null}
    </div>
  );
}

/**
 * The window as a competitor needs to read it: both bounds, spelled out, in their
 * own timezone. Renders nothing when a track has no window, so tracks that never
 * close do not grow an empty panel.
 */
export function SubmissionWindowSummary({
  window,
  state,
}: {
  window: SubmissionWindow;
  state: WindowState;
}) {
  if (!window.opensAt && !window.closesAt) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <SubmissionWindowBadge state={state} />
      {window.opensAt ?
        <span className="text-muted-foreground">
          Opens{" "}
          <time dateTime={window.opensAt} className="text-foreground">
            {formatInstant(window.opensAt)}
          </time>
        </span>
      : null}
      {window.closesAt ?
        <span className="text-muted-foreground">
          Closes{" "}
          <time dateTime={window.closesAt} className="text-foreground">
            {formatInstant(window.closesAt)}
          </time>
        </span>
      : null}
    </div>
  );
}
