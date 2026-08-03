/**
 * Turning what a program returned into a leaderboard row.
 *
 * A board builds a row from an output's top-level keys and stringifies anything
 * that is not a scalar, so a nested object arrives as a JSON blob in one cell
 * with nothing to rank on. That failure is quiet: the job succeeds, the board
 * draws, and the column is full of `{"score":...}`.
 *
 * Refusing here makes it loud, and makes it the program's error rather than the
 * board's, which is where it can actually be fixed.
 */

export type Scalar = string | number | boolean | null;

const scalar = (value: unknown): value is Scalar =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

const describe = (value: unknown) =>
  Array.isArray(value) ? "a list"
  : value === undefined ? "nothing"
  : typeof value === "object" ? "an object"
  : typeof value;

/**
 * Check that a result is one flat row, and hand it back.
 *
 * `where` names the phase and the case in the message, because a competition
 * with forty cases needs to know which one returned the wrong shape.
 */
export const row = (
  value: unknown,
  where: string,
): Record<string, Scalar> => {
  if (value === null || value === undefined) return {};

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      `${where} returned ${describe(value)}. It has to return a flat object: ` +
        `its keys become a leaderboard's columns.`,
    );
  }

  const out: Record<string, Scalar> = {};
  const nested: string[] = [];

  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    if (!scalar(entry)) {
      nested.push(`${key} is ${describe(entry)}`);
      continue;
    }
    // NaN and Infinity are not JSON and arrive as null through the wire. A
    // score that is silently null ranks below zero rather than reporting a
    // division that went wrong, so it is worth naming here.
    if (typeof entry === "number" && !Number.isFinite(entry)) {
      nested.push(`${key} is ${entry}`);
      continue;
    }
    out[key] = entry;
  }

  if (nested.length) {
    throw new Error(
      `${where} returned values a leaderboard cannot rank on: ` +
        `${nested.join(", ")}. Flatten them, or total them, before returning.`,
    );
  }

  return out;
};
