import { HeaderStats } from "@/components/page-header-band";
import { Stat } from "@/components/stat-strip";
import { useNow } from "@/components/submission-window";
import { Skeleton } from "@/components/ui/skeleton";
import { nextInstant, type GateReport } from "@open-competition-kit/sdk/gate";
import { formatInstant } from "@open-competition-kit/sdk/instant";

/**
 * Whatever the gates are counting down to, as a single cell.
 *
 * The label carries what happens and the value carries when, so an open track
 * still says when it stops being one. A track no gate has a date for gets no
 * cell rather than an empty one.
 *
 * A gate that is refusing names the cell even though its date has passed, since
 * "Closed 3 June" is the fact a reader arriving late wants. Otherwise it is
 * whatever comes next.
 */
const deadlineOf = (reports: readonly GateReport[], now: number) => {
  const deciding =
    reports.find((report) => report.state === "blocked" && report.at) ??
    nextInstant(reports, now);

  return deciding?.at ?
      {
        label: deciding.atLabel ?? deciding.label,
        at: deciding.at,
        closed: deciding.state === "blocked",
      }
    : undefined;
};

/**
 * What the track offers first, then what has happened in it, then where the
 * reader stands: the deadline is the only one of the four that expires, and the
 * last is the only one that is about them.
 */
export function TrackStats({
  reports,
  submissionCount,
  enrolmentCount,
  isSignedIn,
  isEnrolled,
  enrollmentLoading,
}: {
  reports: readonly GateReport[];
  submissionCount: number | undefined;
  enrolmentCount: number | undefined;
  isSignedIn: boolean;
  isEnrolled: boolean;
  enrollmentLoading: boolean;
}) {
  const deadline = deadlineOf(reports, useNow());

  return (
    <HeaderStats>
      {deadline ? (
        <Stat
          label={deadline.label}
          value={
            <span className="font-sans text-base">
              {formatInstant(deadline.at)}
            </span>
          }
          tone={deadline.closed ? "destructive" : undefined}
        />
      ) : null}
      <Stat label="Submissions" value={submissionCount ?? 0} />
      <Stat label="Enrolments" value={enrolmentCount ?? 0} />
      <Stat
        label="Your enrolment"
        value={
          !isSignedIn ? (
            <span className="font-sans text-base">Not signed in</span>
          ) : enrollmentLoading ? (
            <Skeleton className="h-7 w-28" />
          ) : (
            <span className="font-sans text-base">
              {isEnrolled ? "Enrolled" : "Not enrolled"}
            </span>
          )
        }
        emphasis={isEnrolled}
      />
    </HeaderStats>
  );
}
