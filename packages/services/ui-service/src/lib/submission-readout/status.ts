import { startCase } from "es-toolkit";

export type StatusTone = "success" | "destructive" | "pending" | "unknown";

/**
 * Status words a runner is likely to use, and nothing more.
 *
 * The kit types `job.status` as a plain string and the example runner writes
 * `pending`, `done`, and `error`, so the vocabulary is the runner's rather than
 * ours. An unrecognised word gets the neutral tone: saying nothing about a status
 * we do not know beats colouring a finished job as though it were stuck.
 */
const STATUS_TONES: Record<string, StatusTone> = {
  done: "success",
  completed: "success",
  complete: "success",
  finished: "success",
  success: "success",
  succeeded: "success",
  ok: "success",
  error: "destructive",
  errored: "destructive",
  failed: "destructive",
  failure: "destructive",
  pending: "pending",
  queued: "pending",
  waiting: "pending",
  running: "pending",
  started: "pending",
  cancelled: "unknown",
  canceled: "unknown",
};

export type JobStatus = {
  tone: StatusTone;
  label: string;
  /** True while the job may still change on its own. */
  isSettled: boolean;
};

export function describeJobStatus(status: string | undefined): JobStatus {
  if (!status) {
    return { tone: "unknown", label: "No runs", isSettled: true };
  }

  const tone = STATUS_TONES[status.trim().toLowerCase()] ?? "unknown";
  return {
    tone,
    label: startCase(status.replace(/[-_]+/g, " ")),
    isSettled: tone !== "pending",
  };
}
