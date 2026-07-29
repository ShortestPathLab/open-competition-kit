import {
  describeWindowState,
  formatInstant,
  submissions,
  tracks,
  unsafe,
  windowStateAt,
  type Refusal,
  type Submission,
} from "@open-competition-kit/sdk";

/**
 * The parts of a track's config these gates read.
 *
 * Every field is optional and every one of them is off when absent, so a track
 * that configures none of this behaves exactly as it did before gates existed.
 */
type GatedTrack = {
  opensAt?: string;
  closesAt?: string;
  maxSubmissions?: number;
  rateLimit?: { count: number; windowMinutes: number };
};

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * "hour" and "day" rather than "60 minutes" and "1440 minutes", because that is
 * how the rule was meant when it was written down.
 */
const describeWindow = (minutes: number) => {
  if (minutes === 60) return "hour";
  if (minutes === 1440) return "day";
  if (minutes % 1440 === 0) return plural(minutes / 1440, "day");
  if (minutes % 60 === 0) return plural(minutes / 60, "hour");
  return plural(minutes, "minute");
};

/** Refuses outside the track's `opensAt`/`closesAt` window. */
export const windowGate = (track: GatedTrack, now: number): Refusal[] => {
  const state = windowStateAt(track, now);
  if (state.status === "open") return [];

  return [
    {
      gate: "window",
      reason: describeWindowState(state),
      detail:
        state.status === "upcoming" ?
          { opensAt: state.opensAt }
        : { closesAt: state.closesAt },
    },
  ];
};

/** Refuses once a competitor has spent every attempt the track allows. */
export const attemptsGate = (track: GatedTrack, mine: Submission[]): Refusal[] => {
  const max = track.maxSubmissions;
  if (!max || mine.length < max) return [];

  return [
    {
      gate: "attempts",
      reason: `You have used all ${plural(max, "submission")} for this track.`,
      detail: { used: mine.length, max },
    },
  ];
};

/**
 * Refuses when too many submissions land inside a rolling window.
 *
 * The window slides: it is measured backwards from now, so the slot that frees
 * up next is the one held by the oldest submission still inside it. That instant
 * is worth returning, since "try again later" without a time is not an answer.
 */
export const rateGate = (
  track: GatedTrack,
  mine: Submission[],
  now: number,
): Refusal[] => {
  const limit = track.rateLimit;
  if (!limit) return [];

  const windowMs = limit.windowMinutes * 60_000;
  const inWindow = mine
    .map((submission) => submission.createdAt.getTime())
    .filter((at) => at > now - windowMs);

  if (inWindow.length < limit.count) return [];

  const retryAt = new Date(Math.min(...inWindow) + windowMs).toISOString();
  return [
    {
      gate: "rate",
      reason:
        `You may make ${plural(limit.count, "submission")} every ` +
        `${describeWindow(limit.windowMinutes)}. You can submit again from ` +
        `${formatInstant(retryAt)}.`,
      detail: {
        used: inWindow.length,
        count: limit.count,
        windowMinutes: limit.windowMinutes,
        retryAt,
      },
    },
  ];
};

/**
 * Every refusal this package has for one competitor on one track.
 *
 * The submission history is fetched once and shared by the two gates that need
 * it, and not fetched at all when neither is configured. That matters more than
 * it looks: this runs on every submission and again every time a form renders,
 * and `Submission` carries no index on `(user, track)`.
 */
export async function standardRefusals(
  user: string,
  track: string,
  now: number,
): Promise<Refusal[]> {
  const def = (await unsafe(tracks.get(track))) as GatedTrack;

  const needsHistory = def.maxSubmissions != null || def.rateLimit != null;
  const mine =
    needsHistory ? await unsafe(submissions.list({ user, track })) : [];

  return [
    ...windowGate(def, now),
    ...attemptsGate(def, mine),
    ...rateGate(def, mine, now),
  ];
}
