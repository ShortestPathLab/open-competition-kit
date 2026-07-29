import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { isDraft, isVisibleTo } from "@open-competition-kit/sdk/visibility";
import { z } from "zod";

import { adminStatus } from "./admin";
import { getAuthSession } from "./auth-server";
import { resolveId } from "./configure-user";

/**
 * Existence checks for the ids that arrive in a URL.
 *
 * Every page under a path parameter used to assume its id was real. A wrong one
 * did not fail loudly: `useCompetition` returned nothing, the page fell through
 * to its loading skeleton, and a mistyped or retired id sat there spinning for
 * as long as you left it open. These guards run before the page does, so a
 * missing record is a 404 and a real one costs one extra config read.
 */

export type CompetitionShape = {
  id: string;
  trackIds: string[];
  leaderboardIds: string[];
  /** True when this is a draft the caller can only see because they organise it. */
  isDraft: boolean;
};

/**
 * Existence is answered from the config, not from the database.
 *
 * The config is what brings a competition into being: it lists the tracks and
 * leaderboards, and the database only mirrors those ids the first time
 * something touches them. Asking the database instead would make "does this
 * exist" depend on whether anyone had visited the page yet.
 *
 * The ids returned here are already public. Every one of them appears in the
 * links on the competition page.
 */
const getCompetitionShape = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(
    async ({ data: competitionId }): Promise<CompetitionShape | null> => {
      const [config, admin] = await Promise.all([
        unsafe(sdk.config.get()),
        adminStatus(),
      ]);
      const competition = config.competitions.find(
        (candidate) => candidate.id === competitionId,
      );
      if (!competition) return null;

      // An unpublished competition reads as one that was never configured. The
      // alternative — "forbidden" — confirms to anyone guessing ids that a
      // competition by that name is being prepared, which is the one thing a
      // draft is for keeping quiet.
      if (!isVisibleTo(competition, admin.isAdmin)) return null;

      return {
        id: competition.id,
        trackIds: competition.tracks.map((track) => track.id),
        leaderboardIds: competition.leaderboards.map(
          (leaderboard) => leaderboard.id,
        ),
        isDraft: isDraft(competition),
      };
    },
  );

/**
 * Guards the whole `/competitions/$id` subtree. Returns the shape so the pages
 * below can check their own ids against it without a second round trip.
 */
export async function ensureCompetition(
  competitionId: string,
): Promise<CompetitionShape> {
  const competition = await getCompetitionShape({ data: competitionId });
  if (!competition) throw notFound({ data: { subject: "competition" } });
  return competition;
}

/**
 * Checks the track against the competition in the URL, not against every track
 * in the config. A track that belongs to another competition is as absent from
 * this one as a track that was never configured.
 */
export function ensureTrack(competition: CompetitionShape, trackId: string) {
  if (!competition.trackIds.includes(trackId)) {
    throw notFound({ data: { subject: "track" } });
  }
}

export function ensureLeaderboard(
  competition: CompetitionShape,
  leaderboardId: string,
) {
  if (!competition.leaderboardIds.includes(leaderboardId)) {
    throw notFound({ data: { subject: "leaderboard" } });
  }
}

const getSubmissionVisibility = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: submissionId }) => {
    const session = await getAuthSession();

    // Signed out callers are told nothing either way. The page has its own sign
    // in prompt, and answering here would turn the guard into an oracle for
    // which submission ids are real.
    if (!session) return "anonymous" as const;

    const result = await sdk.submissions.get(submissionId);

    // Another entrant's submission reads as missing rather than forbidden.
    // "Forbidden" would confirm the id belongs to someone.
    if (result.error || result.value?.user !== resolveId(session.user)) {
      return "missing" as const;
    }

    return "visible" as const;
  });

export async function ensureSubmissionVisible(submissionId: string) {
  const visibility = await getSubmissionVisibility({ data: submissionId });
  if (visibility === "missing") throw notFound({ data: { subject: "submission" } });
  return visibility;
}
