import type { JsonValue } from "../submission-fn";
import { decodeValue, labelForKey } from "./values";

export type ResultEntry = { key: string; label: string; value: JsonValue };
export type ScoreEntry = { key: string; label: string; value: number };

export type ResultReadout = {
  /**
   * The one number worth putting at the top of the page. `total` when the runner
   * writes one, the only number when there is exactly one, and nothing at all when
   * a result carries several numbers with no stated winner: picking one arbitrarily
   * would invent a ranking the runner did not declare.
   */
  headline?: ScoreEntry;
  /** Numeric fields, in the order the runner wrote them. */
  scores: ScoreEntry[];
  /** Strings and booleans, e.g. the `status` and `warning` the suite reports. */
  meta: ResultEntry[];
  /** Nested objects and arrays, which only a JSON block can show honestly. */
  nested: ResultEntry[];
  /** False when the runner wrote no result at all, as a failed job has not. */
  present: boolean;
};

const EMPTY_READOUT: ResultReadout = {
  scores: [],
  meta: [],
  nested: [],
  present: false,
};

/**
 * Keys that describe the run rather than score it.
 *
 * A runner writing `{ status, runtime, warning, score1..4, total }` means only six
 * of those as marks, but nothing in the output says which. Listing the handful of
 * words conventionally about the run keeps `runtime: 41.2` out of the score
 * column, where a number that large would also wreck the scale. An unlisted key is
 * still treated as a score, so a runner with its own vocabulary loses nothing.
 */
const DIAGNOSTIC_KEYS = new Set([
  "status",
  "runtime",
  "duration",
  "elapsed",
  "warning",
  "warnings",
  "error",
  "errors",
  "message",
]);

/**
 * A job's default output, sorted into the shapes a page can render.
 *
 * The kit says only that this value is JSON: a scalar, an object of them, or an
 * array. Anything that is not an object of scalars falls through to the nested
 * bucket rather than being flattened into a shape it never had.
 */
export function readResult(raw: JsonValue | null | undefined): ResultReadout {
  if (raw === null || raw === undefined) return EMPTY_READOUT;

  // A runner that stringified its own output gets read the same way a form control
  // that did is, rather than landing in the nested bucket as one long unscored
  // string.
  const value = decodeValue(raw);

  if (typeof value === "number") {
    const only = { key: "result", label: "Result", value };
    return { headline: only, scores: [], meta: [], nested: [], present: true };
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {
      ...EMPTY_READOUT,
      present: true,
      nested: [{ key: "result", label: "Result", value }],
    };
  }

  const scores: ScoreEntry[] = [];
  const meta: ResultEntry[] = [];
  const nested: ResultEntry[] = [];

  for (const [key, entry] of Object.entries(value)) {
    const label = labelForKey(key);
    const isDiagnostic = DIAGNOSTIC_KEYS.has(key.toLowerCase());

    if (entry !== null && typeof entry === "object") {
      nested.push({ key, label, value: entry });
    } else if (typeof entry === "number" && !isDiagnostic) {
      scores.push({ key, label, value: entry });
    } else {
      meta.push({ key, label, value: entry });
    }
  }

  const total = scores.find((score) => score.key.toLowerCase() === "total");
  const headline = total ?? (scores.length === 1 ? scores[0] : undefined);

  return {
    headline,
    scores: headline ? scores.filter((score) => score !== headline) : scores,
    meta,
    nested,
    present: true,
  };
}

/**
 * The number a run's score bars are drawn against, or nothing when no bar can be
 * honest.
 *
 * A runner writing `score1: 10` says nowhere what 10 is out of, so the ceiling has
 * to come from the run itself: its largest number, counting the total, which is
 * how a component reads as its share of the mark it fed. A run whose numbers all
 * fit in 0 to 1 keeps 1, so a 0.9 does not fill the track for being the best of a
 * weak run. One negative number stops every bar in the run, because a proportion
 * needs a floor and a runner that goes below zero has not named one.
 *
 * The ceiling belongs to the run rather than the row, so a row cannot lose its bar
 * for scoring well while the zeros beside it keep theirs.
 */
export function scoreCeiling(readout: ResultReadout): number | undefined {
  const values = readout.scores.map((score) => score.value);
  if (readout.headline) values.push(readout.headline.value);
  if (!values.length) return undefined;
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return undefined;

  // An all-zero run still draws its empty tracks, which read as scored-and-got-none
  // rather than as a panel that forgot to render.
  return Math.max(1, ...values);
}
