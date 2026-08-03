import { Panel } from "*/components/panel";
import { cn } from "*/lib/utils";
import { CalendarClock, Clock, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { formatInstant } from "@open-competition-kit/sdk/instant";
import {
  competitionSchedule,
  splitRemaining,
  type Milestone,
  type TrackReports,
} from "src/lib/competition-window";

/** How many dated rows fit under the clock before the list starts to sprawl. */
const MILESTONE_LIMIT = 4;

/**
 * The wall clock, once a second.
 *
 * Stays `undefined` until the first effect runs, so the server renders no
 * digits at all. A clock rendered on the server is already wrong by the time it
 * reaches the browser, and React reports the difference as a hydration
 * mismatch. One second of `--` costs less than that.
 */
function useNow() {
  const [now, setNow] = useState<number>();

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return now;
}

function ClockUnit({ value, label }: { value?: number; label: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-2xl font-semibold leading-none tabular-nums">
        {value === undefined ? "--" : String(value).padStart(2, "0")}
      </div>
      <div className="mt-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            milestone.past ? "bg-muted-foreground/40"
            : milestone.state === "ok" ? "bg-success"
            : "bg-warning",
          )}
        />
        <span className="truncate">{milestone.label}</span>
      </span>
      <time
        dateTime={milestone.at}
        className={cn(
          "shrink-0 font-mono text-xs tabular-nums",
          milestone.past ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {formatInstant(milestone.at)}
      </time>
    </div>
  );
}

/**
 * The submission deadline, as a countdown over the dates behind it.
 *
 * Renders nothing until the clock starts, and nothing at all when no track sets
 * an opening or closing time, so a competition that runs indefinitely does not
 * grow an empty panel.
 */
export function DeadlinePanel({
  tracks,
}: {
  tracks: readonly TrackReports[];
}) {
  const now = useNow();

  // Recomputed on every tick rather than memoised against the track list. It is
  // a few passes over a handful of tracks, and keying a memo on an array the
  // caller rebuilds each render would cost more than it saved.
  const schedule = now === undefined ? undefined : competitionSchedule(tracks, now);

  if (!schedule) return null;

  const countdown = schedule.countdown;
  const split =
    countdown ?
      splitRemaining(Date.parse(countdown.at) - (now as number))
    : undefined;

  const shown = schedule.milestones.slice(0, MILESTONE_LIMIT);
  const hidden = schedule.milestones.length - shown.length;

  return (
    <Panel>
      <div className="p-5">
        {countdown ?
          <>
            <div
              className={cn(
                "flex items-center gap-2 text-xs font-medium",
                schedule.status === "upcoming" ?
                  "text-muted-foreground"
                : "text-warning",
              )}
            >
              <Clock className="size-3.5 shrink-0" />
              {countdown.label}
            </div>
            <div className="mt-3.5 grid grid-cols-4 gap-2">
              <ClockUnit value={split?.days} label="days" />
              <ClockUnit value={split?.hours} label="hrs" />
              <ClockUnit value={split?.minutes} label="min" />
              <ClockUnit value={split?.seconds} label="sec" />
            </div>
          </>
        : <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            {schedule.status === "closed" ?
              <>
                <LockKeyhole className="size-3.5 shrink-0" />
                Submissions have closed
              </>
            : <>
                <CalendarClock className="size-3.5 shrink-0" />
                No deadline ahead
              </>
            }
          </div>
        }

        {shown.length ?
          <div className="mt-4 flex flex-col gap-2.5 border-t border-border pt-4">
            {shown.map((milestone) => (
              <MilestoneRow key={milestone.key} milestone={milestone} />
            ))}
            {hidden > 0 ?
              <p className="text-xs text-muted-foreground">
                {hidden} more {hidden === 1 ? "date" : "dates"} on the tracks
                page.
              </p>
            : null}
          </div>
        : null}
      </div>
    </Panel>
  );
}
