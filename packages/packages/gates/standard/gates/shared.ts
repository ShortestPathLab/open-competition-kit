import { submissions, tracks, unsafe } from "@open-competition-kit/sdk";
import { gatedTrack, type GatedTrack } from "../config";

/**
 * How close to a deadline a track starts reading as closing rather than open.
 *
 * Not a state the rules have: a window is open until it is not. It exists because
 * a track with two days left and one with two months left are otherwise the same
 * colour, and only one of them needs you today.
 */
export const CLOSING_SOON_MS = 3 * 24 * 60 * 60 * 1000;

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * "hour" and "day" rather than "60 minutes" and "1440 minutes", because that is
 * how the rule was meant when it was written down.
 */
export const describeWindow = (minutes: number) => {
  if (minutes === 60) return "hour";
  if (minutes === 1440) return "day";
  if (minutes % 1440 === 0) return plural(minutes / 1440, "day");
  if (minutes % 60 === 0) return plural(minutes / 60, "hour");
  return plural(minutes, "minute");
};

/**
 * The track's gate config, parsed by the schema this package declares.
 *
 * Every field is optional and off when absent, so a track configuring none of this
 * behaves exactly as it did before gates existed. Parsing rather than casting means
 * the values have been through the same check that ran at boot, including the
 * `Date` normalisation a YAML timestamp needs.
 */
export const gatesOf = async (track: string): Promise<GatedTrack> => {
  const def = await unsafe(tracks.get(track));
  const parsed = gatedTrack.safeParse(def);
  // Boot already rejected an invalid track, so a failure here means the record came
  // from somewhere else entirely. Treat it as a track with no gates rather than
  // throwing, since throwing inside the chain fails the submission closed for a
  // reason the competitor cannot act on.
  return parsed.success ? parsed.data : {};
};

/** Whether either quota needs the competitor's submission history to answer. */
export const needsHistory = (def: GatedTrack) =>
  def.maxSubmissions != null || def.rateLimit != null;

export const historyFor = async (user: string | undefined, track: string) =>
  user ? await unsafe(submissions.list({ user, track })) : [];
