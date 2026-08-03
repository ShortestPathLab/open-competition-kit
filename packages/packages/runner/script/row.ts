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

/**
 * What a phase a program did not implement would have answered.
 *
 * A program says it has no opinion by replying with `null`, and these fill in.
 * They are the host's rules rather than any competition's: a run with no plan is
 * one case, and a score with no scoring is the numbers added up.
 *
 * Here rather than in the program because otherwise every program in every
 * language writes them again, and the versions drift. It is also what keeps the
 * smallest program small: handle the phase you care about, answer `null` to the
 * rest, and never write a plan you have no opinion about.
 */
export const ONE_UNNAMED_CASE = [null];

/**
 * Sum the numbers, and count the cases.
 *
 * Deliberately the least clever thing that produces a rankable row. Anything
 * past addition is a scoring decision, and those belong to the competition
 * rather than to a default that has to guess.
 *
 * Booleans are excluded on purpose. They arrive as numbers in enough languages
 * that a `passed: true` on forty cases would otherwise report `passed: 40`,
 * which reads like a count of something and is not.
 */
export const sumOf = (
  results: readonly Record<string, Scalar>[],
): Record<string, Scalar> => {
  const total: Record<string, Scalar> = {};
  for (const result of results) {
    for (const [key, value] of Object.entries(result)) {
      if (typeof value !== "number") continue;
      total[key] = ((total[key] as number | undefined) ?? 0) + value;
    }
  }
  total.cases = results.length;
  return total;
};
