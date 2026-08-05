import { adminStatus } from "@/lib/admin";
import { competitions, tracks, unsafe } from "@open-competition-kit/sdk";
import { isVisibleTo } from "@open-competition-kit/sdk/visibility";

/**
 * A draft is missing rather than forbidden, for the same reason the route guard
 * says so: "forbidden" tells a stranger the competition exists.
 *
 * This lives here rather than only in the guard because every one of these
 * summaries is reachable through a `createServerFn`, and a server function is a
 * public HTTP endpoint whether or not a route ever renders it.
 */
export class CompetitionNotFoundError extends Error {
  constructor(id: string) {
    super(`Competition "${id}" not found.`);
  }
}

/**
 * The competition, or nothing at all.
 *
 * Every read in this module goes through here, so there is one place where a
 * draft becomes a 404 and one place to change if that ever stops being the
 * right answer.
 */
export async function requireVisibleCompetition(id: string) {
  const [competition, admin] = await Promise.all([unsafe(competitions.get(id)), adminStatus()]);

  if (!isVisibleTo(competition, admin.isAdmin)) {
    throw new CompetitionNotFoundError(id);
  }

  return competition;
}

/**
 * Guards a write against the track's competition being published.
 *
 * Reading a draft is already impossible for anyone but an organiser, but
 * enrolling and submitting do not go through any of the read paths: they take a
 * track id and act on it. Without this, a track id leaked or guessed while a
 * competition was still being drafted would still accept entrants.
 */
export async function ensureTrackAvailable(trackId: string): Promise<void> {
  const track = await unsafe(tracks.get(trackId));
  await requireVisibleCompetition(track.competition);
}
