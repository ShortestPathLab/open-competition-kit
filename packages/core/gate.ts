import type { SerialisableObject } from "./serialisable";

/**
 * One reason a submission is not allowed through.
 *
 * Import-free, like `./config/window`: core raises these, packages contribute
 * them, and the browser renders them, so a single definition is what keeps the
 * refusal a competitor reads identical to the one the server acted on.
 */
export type Refusal = {
  /**
   * Which gate said no, e.g. `"window"` or `"attempts"`. Stable across releases:
   * a UI keys off this to decide how to present a refusal, and an organiser reads
   * it in a log to find out which rule they configured is biting.
   */
  gate: string;
  /** Shown to the competitor as written. */
  reason: string;
  /**
   * Anything the UI can use beyond the sentence, such as how many attempts were
   * spent or when the next one becomes available. Serialisable because it crosses
   * to the browser.
   */
  detail?: SerialisableObject;
};

export type GateVerdict = {
  allowed: boolean;
  refusals: readonly Refusal[];
};

/**
 * The payload threaded through the gate chain.
 *
 * `refusals` carries what the packages further out have already decided. Every
 * implementation adds its own and passes the combined list inward, in the same
 * shape `form.loader` threads its `def`.
 */
export type GateRequest = {
  user: string;
  track: string;
  refusals: readonly Refusal[];
};

export const verdictOf = (refusals: readonly Refusal[]): GateVerdict => ({
  allowed: refusals.length === 0,
  refusals,
});

/** One sentence for all of it, for an error message or a log line. */
export const describeRefusals = (refusals: readonly Refusal[]) =>
  refusals.map((refusal) => refusal.reason).join(" ") ||
  "This submission was refused.";
