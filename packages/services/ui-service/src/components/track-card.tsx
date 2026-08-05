import { WindowStatus } from "@/components/submission-window";
import { TrackIcon } from "@/components/entity-icon";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import type { GateReport } from "@open-competition-kit/sdk/gate";
import { ArrowRight, Check } from "lucide-react";
import type { ReactNode } from "react";

interface TrackCardProps {
  id: string;
  competitionId: string;
  name: string;
  description: string;
  /** The organiser's picture for this track, when they configured one. */
  icon?: string;
  /**
   * What the installed gates say about this track. Given a non-empty list, the
   * card grows a column saying whether it is open and when that changes.
   */
  reports?: readonly GateReport[];
  /**
   * How many submissions the reader has made here. `undefined` means they are
   * not enrolled, which is a different statement from `0`.
   */
  submissions?: number;
  /**
   * Whether the enrolment column exists at all. Off, a card says nothing about
   * the reader, which is right for a signed-out visitor and for the overview's
   * grid. On, a track they have not entered says so, so the column lines up
   * down the list instead of appearing only on some rows.
   */
  showEnrolment?: boolean;
  /**
   * The action for this row. Given, the card stops being one big link and only
   * its title navigates, because a link inside a link is not a thing.
   */
  action?: ReactNode;
  /** Muted treatment for a track that has closed. */
  dim?: boolean;
  className?: string;
}

/**
 * A track, as a card in a grid or as a row in a list.
 *
 * The plain form is the whole card a link, which is what the competition
 * overview shows four of. Passing reports, an enrolment, or an action turns it
 * into the list row the tracks page uses, where those extra columns are the
 * reason to be on that page at all.
 */
export function TrackCard({
  id,
  competitionId,
  name,
  description,
  icon,
  reports,
  submissions,
  showEnrolment = false,
  action,
  dim = false,
  className,
}: TrackCardProps) {
  const body = (
    <>
      <TrackIcon
        competitionId={competitionId}
        trackId={id}
        icon={icon}
        className={cn("size-14 rounded-lg", dim && "opacity-60")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3
            className={cn("text-base font-semibold tracking-tight", dim && "text-muted-foreground")}
          >
            {action ? (
              <Link
                to="/competitions/$id/tracks/$trackId"
                params={{ id: competitionId, trackId: id }}
                className="hover:text-primary"
              >
                {name}
              </Link>
            ) : (
              name
            )}
          </h3>
          {action ? null : (
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          )}
        </div>
        <p
          className={cn(
            "mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground",
            dim && "text-muted-foreground/70",
          )}
        >
          {description}
        </p>
      </div>
      {reports?.length ? <WindowStatus reports={reports} className="sm:w-44 sm:shrink-0" /> : null}
      {!showEnrolment && submissions === undefined ? null : (
        <div className="text-sm sm:w-32 sm:shrink-0">
          {submissions === undefined ? (
            <span className="text-muted-foreground">Not entered</span>
          ) : (
            <>
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="size-3.5 text-success" />
                Entered
              </span>
              <span className="mt-1 block font-mono text-xs text-muted-foreground">
                {submissions} submission{submissions === 1 ? "" : "s"}
              </span>
            </>
          )}
        </div>
      )}
      {action ? <div className="shrink-0">{action}</div> : null}
    </>
  );

  const shell = cn(
    "flex flex-wrap gap-4 rounded-xl border border-border bg-card p-5 transition-colors sm:flex-nowrap sm:items-center",
    className,
  );

  // A row that carries its own action cannot be a link, so only its title is
  // one. Without an action the whole card stays clickable, which is what the
  // competition overview's grid relies on.
  if (action) return <div className={shell}>{body}</div>;

  return (
    <Link
      to="/competitions/$id/tracks/$trackId"
      params={{ id: competitionId, trackId: id }}
      className={cn(shell, "group hover:border-ring")}
    >
      {body}
    </Link>
  );
}
