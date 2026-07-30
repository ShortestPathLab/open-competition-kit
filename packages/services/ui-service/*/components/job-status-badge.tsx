import { StatusPill } from "*/components/status-pill";
import { describeJobStatus } from "src/lib/submission-readout";

/**
 * A job's status, coloured by what the word means rather than by matching one
 * exact spelling. `describeJobStatus` owns the vocabulary, `StatusPill` owns
 * the paint, and this joins them.
 */
export function JobStatusBadge({
  status,
  className,
}: {
  /** The runner's word for it. Absent means nothing has run yet. */
  status?: string;
  className?: string;
}) {
  const { tone, label, isSettled } = describeJobStatus(status);

  return (
    <StatusPill tone={tone} pulse={!isSettled} className={className}>
      {label}
    </StatusPill>
  );
}
