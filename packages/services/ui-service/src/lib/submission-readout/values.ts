import { startCase } from "es-toolkit";
import type { JsonValue } from "../submission-fn";

/** Deep enough for anything a form or a runner has written so far. */
const MAX_DECODE_DEPTH = 8;

/**
 * A value read back as far as it was encoded.
 *
 * A form control with more than one thing to say has nowhere to put it. A
 * submission body is an object of answers and an answer is whatever the control
 * wrote, so a control carrying structure encodes it as JSON and stores the string:
 * `github:ref-select` writes `{"owner","repo","ref"}` that way. Printing the
 * string back is how a page ends up showing somebody their own braces.
 *
 * Only objects and arrays are unwrapped. Reading the string `"true"` back as a
 * boolean would change the answer somebody gave, where reading `"{...}"` back as
 * its object only stops the page from showing the transport it arrived in.
 */
export function decodeValue(value: JsonValue, depth = 0): JsonValue {
  if (depth >= MAX_DECODE_DEPTH) return value;

  if (typeof value === "string") {
    // Parsing every string would also turn the answer "42" into a number, which is
    // a different answer from the one that was typed.
    const trimmed = value.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;

    try {
      const parsed = JSON.parse(trimmed) as JsonValue;
      if (parsed !== null && typeof parsed === "object") {
        return decodeValue(parsed, depth + 1);
      }
    } catch {
      // A string that opens with a brace and is not JSON. Leave it as written.
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => decodeValue(entry, depth + 1));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, decodeValue(entry, depth + 1)]),
    );
  }

  return value;
}

/**
 * A key as a heading. `score1` keeps its shape because "Score 1" is not what the
 * runner called it, and a column of "Score 1, Score 2" reads as prose where the
 * runner meant identifiers.
 */
export const labelForKey = (key: string) => (/^[a-z0-9_]+\d$/i.test(key) ? key : startCase(key));

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
 * A JSON value as a block of text. A string that is itself JSON gets
 * pretty-printed, because a runner that stringified its own output should not be
 * punished with one unreadable line.
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
