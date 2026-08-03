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
 * What one gate has to say about a track, whether or not it is refusing.
 *
 * A `Refusal` only exists once the answer is no, which leaves the product with
 * nothing to show for the far more common case: a track that is open and closes
 * on Friday, a competitor with seventeen attempts left. Those are the same rules
 * speaking, and a page that wants to say so should not have to reimplement them
 * from config fields core does not own.
 *
 * Core defines the shape and nothing else. It has no idea what a deadline or a
 * quota is; it knows a report has a state it can rank, a label it can print, and
 * possibly an instant it can count down to. That is enough to sort a list of
 * tracks, draw a pill, and build a competition-wide schedule out of parts no
 * single package could assemble.
 */
export type GateReport = {
  /**
   * Which gate is speaking, e.g. `"window"` or `"attempts"`. The same namespace
   * as `Refusal.gate`, and stable for the same reasons: a UI keys off it, and
   * two tracks reporting the same gate are comparable to each other.
   */
  gate: string;
  /**
   * How much this gate is in the way. The same three words a surface checklist
   * uses, so a host that already ranks those does not learn a second scale.
   *
   * `blocked` means a submission would be refused right now, and every `blocked`
   * report should have a matching `Refusal` from the same gate.
   */
  state: "ok" | "pending" | "blocked";
  /** Shown as written, and short enough for a pill: "Open", "Closes soon". */
  label: string;
  /**
   * A sentence for somewhere with room. Absent when the label says it all.
   */
  detail?: string;
  /**
   * The instant this report is counting toward, if it has one: when a track
   * opens, when it closes, when the next attempt frees up.
   *
   * What makes a competition-wide schedule possible without core knowing what
   * any of those mean. Instants of the same `gate` across tracks are the same
   * kind of event, so they can be grouped, labelled and ranked as one.
   */
  at?: string;
  /**
   * What happens at `at`, as a heading for a dated row: "Opens", "Closes".
   *
   * Supplied by the package because only it knows the tense. A track that has
   * already closed says "Closed" and one that closes on Friday says "Closes",
   * and core has no way to tell those apart from an instant and a state.
   */
  atLabel?: string;
  /** Anything a renderer can use beyond the sentence. Crosses to the browser. */
  data?: SerialisableObject;
};

/**
 * The payload threaded through the status chain.
 *
 * Threaded exactly like `GateRequest`: `reports` holds what the packages further
 * out have contributed, and an implementation appends its own before passing the
 * combined list inward.
 *
 * `user` is optional because most of what a competitor wants to know is not
 * about them. A public track list asks with no session and gets the schedule; a
 * signed-in competitor asks again and additionally gets their own quota.
 */
export type GateStatusRequest = {
  track: string;
  user?: string;
  reports: readonly GateReport[];
};

const SEVERITY = { ok: 0, pending: 1, blocked: 2 } as const;

/**
 * The worst thing any gate has to say, which is what a single pill shows.
 *
 * `ok` when nothing is reported at all: a track with no gates installed is not
 * in an unknown state, it is unconditionally open.
 */
export const worstOf = (reports: readonly GateReport[]): GateReport["state"] =>
  reports.reduce<GateReport["state"]>(
    (worst, report) =>
      SEVERITY[report.state] > SEVERITY[worst] ? report.state : worst,
    "ok",
  );

/**
 * The next instant worth counting down to, across a set of reports.
 *
 * Blocked gates first when they carry one, since "you can submit again at 11:40"
 * is more use than the deadline three weeks out. Otherwise the soonest instant
 * still ahead.
 */
export const nextInstant = (
  reports: readonly GateReport[],
  now: number,
): GateReport | undefined => {
  const ahead = reports
    .filter((report) => report.at && Date.parse(report.at) > now)
    .sort((a, b) => Date.parse(a.at!) - Date.parse(b.at!));

  return ahead.find((report) => report.state === "blocked") ?? ahead[0];
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
