/**
 * How a submission and its runs read on screen.
 *
 * A runner decides what a job's status word is and what shape its result takes,
 * so every page that shows either has to make the same guesses. Making them
 * once here is what keeps a track's list, a submission's row, and the detail
 * page from disagreeing about whether `done` means finished.
 */
import { startCase } from "es-toolkit";
import type { JsonValue } from "./submission-fn";

export type StatusTone = "success" | "destructive" | "pending" | "unknown";

/**
 * Status words a runner is likely to use, and nothing more.
 *
 * The kit types `job.status` as a plain string and the example runner writes
 * `pending`, `done`, and `error`, so the vocabulary is the runner's rather than
 * ours. An unrecognised word gets the neutral tone: saying nothing about a
 * status we do not know beats colouring a finished job as though it were stuck.
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

// ─── Results ─────────────────────────────────────────────────────────────────

export type ResultEntry = { key: string; label: string; value: JsonValue };
export type ScoreEntry = { key: string; label: string; value: number };

export type ResultReadout = {
  /**
   * The one number worth putting at the top of the page. `total` when the
   * runner writes one, the only number when there is exactly one, and nothing
   * at all when a result carries several numbers with no stated winner: picking
   * one arbitrarily would be inventing a ranking the runner did not declare.
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

const labelFor = (key: string) =>
  /^[a-z0-9_]+\d$/i.test(key) ? key : startCase(key);

/**
 * Keys that describe the run rather than score it.
 *
 * A runner writing `{ status, runtime, warning, score1..4, total }` means only
 * six of those as marks, but nothing in the output says which. Listing the
 * handful of words that are conventionally about the run keeps `runtime: 41.2`
 * out of the score column, where a number that large would also wreck the
 * scale. An unlisted key is still treated as a score, so a runner that invents
 * its own vocabulary loses nothing.
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
export function readResult(value: JsonValue | null | undefined): ResultReadout {
  if (value === null || value === undefined) return EMPTY_READOUT;

  if (typeof value === "number") {
    const only = { key: "result", label: "Result", value };
    return { headline: only, scores: [], meta: [], nested: [], present: true };
  }

  if (typeof value !== "object" || Array.isArray(value)) {
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
    const label = labelFor(key);
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

/** Enough decimal places for a score, without printing 0.9188000000000001. */
export function formatScore(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(4)));
}

export function formatResultValue(value: JsonValue): string {
  if (value === null) return "None";
  if (typeof value === "number") return formatScore(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/**
 * A JSON value as a block of text.
 *
 * A string that is itself JSON gets pretty-printed, because a runner that
 * stringified its own output should not be punished with one unreadable line.
 */
export function prettyJson(value: unknown): string {
  if (value === null || value === undefined) return "None";

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed !== null && typeof parsed === "object") {
        return JSON.stringify(parsed, null, 2);
      }
    } catch {
      // Not JSON. Show the string as written.
    }
    return value;
  }

  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

// ─── Submission bodies ───────────────────────────────────────────────────────

/**
 * The marker on a stored file, copied from `core/file.ts` rather than imported.
 *
 * That module pulls in effect's schema builder, which is a lot of bundle for a
 * shape check the browser can do with one comparison. If the literal ever
 * changes, `FILE_REF` is the thing to change with it.
 */
const FILE_REF = "open-competition-kit/file";

export type SubmittedFile = { name: string; size: number };

export type BodyField = {
  key: string;
  label: string;
  value: JsonValue;
  /** Set when the field holds a `FileRef`, so it renders as a file. */
  file?: SubmittedFile;
};

export type BodyReadout = {
  /**
   * The body parsed as the form values it was submitted as. Null when the body
   * is not a JSON object, e.g. a track whose form posts plain text.
   */
  fields: BodyField[] | null;
  /** The body as written, which the page keeps offering under the fields. */
  raw: string;
};

function asFile(value: JsonValue): SubmittedFile | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const ref = value as Record<string, JsonValue>;
  if (ref.$type !== FILE_REF) return undefined;

  return {
    name: typeof ref.name === "string" ? ref.name : "Uploaded file",
    size: typeof ref.size === "number" ? ref.size : 0,
  };
}

/**
 * A submission body read back as the form that produced it.
 *
 * `createSubmission` stores `JSON.stringify(formValues)`, so the body is an
 * object of answers rather than prose. Showing it as one clamped blob was the
 * single worst thing on the submissions list.
 */
export function readBody(body: string): BodyReadout {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { fields: null, raw: body };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { fields: null, raw: body };
  }

  const fields = Object.entries(parsed as Record<string, JsonValue>).map(
    ([key, value]) => ({
      key,
      // TODO(forms): the track's form definition holds the real field labels.
      // Until the submission endpoints carry it, a title-cased key is the best
      // name available, which reads fine for `teamName` and poorly for `q1a`.
      label: startCase(key),
      value,
      file: asFile(value),
    }),
  );

  return { fields, raw: body };
}

export type BodySummary = {
  /** The uploaded file, when the form took one. */
  file?: string;
  /** The first piece of text the entrant wrote, trimmed to one line. */
  text?: string;
};

/** One line describing a submission, for a row that has no room for more. */
export function summariseBody(body: string): BodySummary {
  const { fields, raw } = readBody(body);

  if (!fields) {
    const line = raw.trim().split("\n")[0] ?? "";
    return { text: line.length > 90 ? `${line.slice(0, 90)}...` : line };
  }

  const file = fields.find((field) => field.file)?.file?.name;
  const text = fields
    .filter((field) => !field.file && typeof field.value === "string")
    .map((field) => (field.value as string).trim())
    .find((value) => value.length > 0);

  return {
    file,
    text: text && text.length > 90 ? `${text.slice(0, 90)}...` : text,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
