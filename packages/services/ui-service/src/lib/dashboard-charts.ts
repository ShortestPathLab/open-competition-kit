/**
 * What the overview's charts are drawn from.
 *
 * Separated from the components that draw them because it is all arithmetic on
 * the activity read, and arithmetic is worth testing: a histogram that drops the
 * top score into a bin past the end, or a day axis that omits the quiet days,
 * are both wrong in ways that still render.
 */
import { countBy, groupBy } from "es-toolkit";
// `min`/`max` live in the compat layer rather than the main module, the same
// place `access.ts` and the SDK's proxy take theirs from.
import { max, min } from "es-toolkit/compat";
import type { ActivityRow } from "./dashboard-data";
import { formatScore, readResult } from "./submission-readout";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** UTC, like every other instant on the dashboard, and stable across hydration. */
export const dayKey = (iso: string) => iso.slice(0, 10);

export const dayLabel = (key: string) => {
  const date = new Date(`${key}T00:00:00Z`);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
};

export const addDays = (key: string, days: number) => {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Beyond this the columns are thinner than the gaps between them. */
export const MAX_DAYS = 90;

export type DayPoint = { day: string; label: string; submissions: number };

/**
 * Submissions per day, with the quiet days present.
 *
 * The gaps are the point. A competition's shape is mostly when nothing happened
 * and then everything did, and a series built only from the days that have rows
 * draws a steady trickle over any pattern at all: three submissions on Monday
 * and three more a fortnight later become two equal bars side by side.
 */
export function byDay(rows: readonly ActivityRow[]): DayPoint[] {
  const dated = rows.filter((row) => row.submittedAt !== null);
  if (dated.length === 0) return [];

  const counts = countBy(dated, (row) => dayKey(row.submittedAt as string));
  // Sorted in place, which is safe: the array was built one line ago and nobody
  // else holds it. (`toSorted` is past this project's TypeScript lib target.)
  const days = Object.keys(counts).sort();
  const last = days.at(-1) as string;
  // Anchored to the last day rather than the first, so a competition that ran a
  // pilot six months ago does not squeeze this week into one pixel.
  const earliest = addDays(last, -(MAX_DAYS - 1));
  const first = (days[0] as string) < earliest ? earliest : (days[0] as string);

  const out: DayPoint[] = [];
  for (let key = first; key <= last; key = addDays(key, 1)) {
    out.push({ day: key, label: dayLabel(key), submissions: counts[key] ?? 0 });
  }
  return out;
}

/** Somebody's best run, or nothing when none of their runs produced a number. */
export function bestScores(rows: readonly ActivityRow[]): number[] {
  const scored = rows.flatMap((row) => {
    const headline = readResult(row.result).headline;
    return headline ? [{ user: row.user, score: headline.value }] : [];
  });

  return Object.values(groupBy(scored, (entry) => entry.user)).map(
    // Never empty: `groupBy` only makes a group for something it put in it.
    (entries) => max(entries.map((entry) => entry.score)) as number,
  );
}

/**
 * How many bins the scores get.
 *
 * Square root of the count, which is the usual rule and errs toward too few
 * rather than too many: a histogram with more bins than entrants draws one bar
 * per person and says nothing a list would not say better.
 */
export const binCount = (n: number) => Math.min(10, Math.max(4, Math.round(Math.sqrt(n))));

export type ScoreBin = { label: string; competitors: number };

export function histogram(scores: readonly number[]): ScoreBin[] {
  if (scores.length === 0) return [];

  // Rather than spreading into `Math.min`, which blows the stack on a field of
  // any size, and a competition with tens of thousands of entrants is the exact
  // case this chart is for. Both are defined: the empty list returned above.
  const low = min(scores as number[]) as number;
  const high = max(scores as number[]) as number;

  // Everybody on the same mark. One bin is the honest drawing of that, and
  // dividing by a zero-width range is the alternative.
  if (low === high) {
    return [{ label: formatScore(low), competitors: scores.length }];
  }

  const bins = binCount(scores.length);
  const width = (high - low) / bins;
  const counts: number[] = Array.from({ length: bins }, () => 0);

  for (const score of scores) {
    // The top score belongs in the last bin rather than in a bin past the end.
    const index = Math.min(bins - 1, Math.floor((score - low) / width));
    counts[index] = (counts[index] ?? 0) + 1;
  }

  return counts.map((competitors, index) => ({
    label: `${formatScore(low + index * width)}-${formatScore(low + (index + 1) * width)}`,
    competitors,
  }));
}
