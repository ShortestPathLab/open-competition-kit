import { Badge } from "*/components/ui/badge";
import { CalendarClock, CircleCheck, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
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
