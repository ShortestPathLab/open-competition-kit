/**
 * Rendering an instant for a reader.
 *
 * Free of imports on purpose. The server writes these into refusals and reports
 * and the browser draws them, so both sides need the same function, and anything
 * pulling `effect` in here would land in the client bundle.
 *
 * Nothing about this is competition-specific, which is why it sits in the SDK
 * rather than in the package that owns deadlines: a quota that resets, a job that
 * timed out and a track that closed all want the same sentence.
 */

/**
 * An ISO instant in the reader's own timezone, with the zone named.
 *
 * Spelled out field by field rather than with `dateStyle`/`timeStyle`, which
 * throw outright when combined with `timeZoneName`. The zone is the one part
 * that cannot be dropped: a deadline read in the wrong timezone is missed.
 *
 * An unparseable value is handed back as written. A malformed instant in a config
 * file should look wrong on the page, not disappear behind "Invalid Date".
 */
export const formatInstant = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
};

export type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function splitRemaining(ms: number): Remaining {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

/**
 * A duration as the one unit worth reading: "3 days", "5 hours", "40 minutes".
 *
 * A list needs the distance to an instant rather than the instant itself, and it
 * needs it short enough to sit in a column. The exact time stays beside it for
 * anyone who wants to check.
 */
export function describeDuration(ms: number): string {
  const { days, hours, minutes } = splitRemaining(ms);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"}`;
  if (minutes >= 1) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return "under a minute";
}
