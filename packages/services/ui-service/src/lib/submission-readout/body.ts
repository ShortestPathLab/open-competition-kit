import type { JsonValue } from "../submission-fn";
import { decodeValue, formatResultValue, labelForKey } from "./values";

/**
 * The marker on a stored file, copied from `core/file.ts` rather than imported.
 * That module pulls in effect's schema builder, which is a lot of bundle for a
 * shape check the browser can do with one comparison. If the literal ever changes,
 * `FILE_REF` is the thing to change with it.
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
   * The body read back as the answers it was submitted as.
   *
   * A body that is not an object of answers, e.g. a track whose form posts plain
   * text, still gets one field holding whatever was written. Every page then has
   * the same shape to draw, and none needs a raw fallback for the case where a
   * track's form does not look like the others.
   */
  fields: BodyField[];
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

/** The key given to a body that is not an object of named answers. */
const WHOLE_BODY_KEY = "body";

/** A body with no name of its own, since the panel around it is already named. */
const wholeBody = (value: JsonValue, raw: string): BodyReadout => ({
  fields: [{ key: WHOLE_BODY_KEY, label: "", value, file: asFile(value) }],
  raw,
});

/**
 * A submission body read back as the form that produced it. `createSubmission`
 * stores `JSON.stringify(formValues)`, so the body is an object of answers rather
 * than prose.
 */
export function readBody(body: string): BodyReadout {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    // Not JSON at all, so the body is the answer.
    return wholeBody(body, body);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return wholeBody(decodeValue(parsed as JsonValue), body);
  }

  const fields = Object.entries(parsed as Record<string, JsonValue>).map(([key, value]) => {
    const decoded = decodeValue(value);
    return {
      key,
      // TODO(forms): the track's form definition holds the real field labels.
      // Until the submission endpoints carry it, a title-cased key is the best
      // name available, which reads fine for `teamName` and poorly for `q1a`.
      label: labelForKey(key),
      value: decoded,
      file: asFile(decoded),
    };
  });

  return { fields, raw: body };
}

export type BodyFact = {
  /** The answer's own name. Empty for a body that holds a single unnamed one. */
  label: string;
  value: string;
};

export type BodySummary = {
  /** The uploaded file, when the form took one. */
  file?: string;
  /**
   * The answers as a row can carry them: the scalars at the bottom of whatever was
   * submitted, in the order the entrant wrote them.
   */
  facts: BodyFact[];
};

/** More than a row has width for, whatever the window is doing. */
const MAX_SUMMARY_FACTS = 6;
const MAX_SUMMARY_TEXT = 90;

function collectFacts(label: string, value: JsonValue, into: BodyFact[]): void {
  if (into.length >= MAX_SUMMARY_FACTS) return;
  if (value === null) return;

  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectFacts(`${label} ${index + 1}`.trim(), entry, into));
    return;
  }

  if (typeof value === "object") {
    // The inner name wins. A `github:ref` holding an owner, a repo and a ref is
    // three answers, and prefixing each with the outer name says nothing the row
    // has room to say.
    for (const [key, entry] of Object.entries(value)) {
      collectFacts(labelForKey(key), entry, into);
    }
    return;
  }

  const text = formatResultValue(value).trim();
  if (!text) return;

  into.push({
    label,
    value: text.length > MAX_SUMMARY_TEXT ? `${text.slice(0, MAX_SUMMARY_TEXT)}...` : text,
  });
}

/** What a submission says about itself, for a row that has one line for it. */
export function summariseBody(body: string): BodySummary {
  const facts: BodyFact[] = [];
  let file: string | undefined;

  for (const field of readBody(body).fields) {
    if (field.file) {
      file ??= field.file.name;
      continue;
    }
    collectFacts(field.label, field.value, facts);
  }

  return { file, facts };
}
