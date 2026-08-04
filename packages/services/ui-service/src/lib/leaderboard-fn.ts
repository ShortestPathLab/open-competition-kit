import { createServerFn, useServerFn } from "@tanstack/react-start";
import { skipToken, useQuery } from "@tanstack/react-query";
import sdk, { enrolments, unsafe, type $props } from "@open-competition-kit/sdk";
import { uniq } from "es-toolkit";
import { z } from "zod";
import { getAuthSession } from "./auth-server";
import { resolveId } from "./configure-user";

export type LeaderboardSummary = {
  id: string;
  name: string;
  description?: string;
  competitionId: string;
  competitionName: string;
};

type Cell = string | number | boolean | null;

/**
 * The columns a board puts a competitor's identity in.
 *
 * `groupBy: user` writes `user`; boards written by hand have been seen using
 * `userId`. Neither name is reserved, so both are read and the first one that
 * answers wins.
 */
const PARTICIPANT_KEYS = ["user", "userId"] as const;

const participantIdOf = (row: Record<string, Cell>): string | undefined => {
  for (const key of PARTICIPANT_KEYS) {
    const value = row[key];
    if (value !== null && value !== undefined) return String(value);
  }
  return undefined;
};

/**
 * What to call each competitor, instead of what the kit files them under.
 *
 * `resolveId` keys a user by email, so a board grouped by user arrives holding a
 * column of them, and a public leaderboard is the last place an email belongs.
 * `users` carries the name the entrant signed up with. A user with no name keeps
 * their id, which only happens for someone who never signed in through the app
 * that upserts the name.
 */
async function participantNames(
  rows: Record<string, Cell>[],
): Promise<Map<string, string>> {
  // By id rather than by listing everyone: a board is capped at its own `limit`,
  // where the user table grows with the whole cohort.
  const ids = uniq(rows.flatMap((row) => participantIdOf(row) ?? []));

  const named = await Promise.all(
    ids.map(async (id) => {
      const user = await unsafe(sdk.users.get(id)).catch(() => undefined);
      return [id, user?.name] as const;
    }),
  );

  return new Map(
    named.flatMap(([id, name]) =>
      name ? [[id, name] as [string, string]] : [],
    ),
  );
}

/** A row with its competitor named rather than identified. */
function nameParticipant(
  row: Record<string, Cell>,
  names: Map<string, string>,
): Record<string, Cell> {
  const named = { ...row };
  for (const key of PARTICIPANT_KEYS) {
    const value = named[key];
    if (value === null || value === undefined) continue;
    named[key] = names.get(String(value)) ?? value;
  }
  return named;
}

export const getLoadedLeaderboard = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: leaderboardId }) => {
    const def = await unsafe(sdk.leaderboards.load(leaderboardId));
    const items = def.items as Record<string, Cell>[] | undefined;
    if (!items?.length) return def as (typeof $props.leaderboard.ui)["def"];

    // Renamed here rather than in the renderer, so every board gets it whatever
    // package draws it, and so no competitor's email crosses the wire.
    const names = await participantNames(items);

    return {
      ...def,
      items: items.map((row) => nameParticipant(row, names)),
    } as (typeof $props.leaderboard.ui)["def"];
  });

export const getCompetitionLeaderboards = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: competitionId }): Promise<LeaderboardSummary[]> => {
    const config = await unsafe(sdk.config.get());
    const competition = config.competitions.find((c) => c.id === competitionId);
    if (!competition) return [];

    return competition.leaderboards.map((leaderboard) => ({
      id: leaderboard.id,
      name: leaderboard.name ?? leaderboard.label ?? leaderboard.id,
      description: leaderboard.description,
      competitionId: competition.id,
      competitionName: competition.name ?? competition.id,
    }));
  });

/**
 * One board's rows. Kept out of the route loader so the leaderboards page can
 * put every board up at once and let each one fill in as it arrives, rather
 * than holding the whole page on the slowest board.
 */
export function useLoadedLeaderboard(leaderboardId?: string) {
  const fetch = useServerFn(getLoadedLeaderboard);
  return useQuery({
    queryKey: ["leaderboard", leaderboardId],
    queryFn:
      leaderboardId ? () => fetch({ data: leaderboardId }) : skipToken,
  });
}

export function useCompetitionLeaderboards(competitionId?: string) {
  const fetch = useServerFn(getCompetitionLeaderboards);
  return useQuery({
    queryKey: ["competition-leaderboards", competitionId],
    queryFn:
      competitionId ? () => fetch({ data: competitionId }) : skipToken,
  });
}

// ─── Standings ───────────────────────────────────────────────────────────────

export type StandingsEntry = {
  rank: number;
  competitor: string;
  score: Cell;
  /** True for the row belonging to whoever asked. Decided on the server. */
  isYou: boolean;
};

export type CompetitionStandings = {
  leaderboardId: string;
  leaderboardName: string;
  /** What the board is a standing of: "Main Track · Total". */
  caption: string;
  /** Rows on the whole board, not just the ones returned. */
  total: number;
  top: StandingsEntry[];
  /** The caller's row, present only when they placed below `top`. */
  you?: StandingsEntry;
};

const standingsInput = z.object({
  competitionId: z.string(),
  limit: z.number().int().positive().max(25).optional(),
});

/**
 * A compact reading of one of a competition's leaderboards.
 *
 * The kit has no competition-wide ranking to report. A competition owns a list
 * of boards, and each one declares its own ordering in `from.rank`, its own
 * columns in `shape`, and its own renderer in `with`. So this does not invent a
 * standing: it picks a board the organiser already configured and reads the
 * three fields a rail card can show.
 *
 * Everything below top-N is dropped here rather than in the browser. A rail card
 * needs five rows out of a board that may hold thousands, and the caller has no
 * business receiving other competitors' user ids to work out which row is
 * theirs.
 */
export const getCompetitionStandings = createServerFn({ method: "GET" })
  .inputValidator(standingsInput)
  .handler(
    async ({ data }): Promise<CompetitionStandings | null> => {
      const limit = data.limit ?? 5;
      const config = await unsafe(sdk.config.get());
      const competition = config.competitions.find(
        (candidate) => candidate.id === data.competitionId,
      );
      if (!competition) return null;

      /**
       * How a board says its rows are ordered.
       *
       * `from` belongs to whichever package loads the board rather than to core,
       * so this reads it loosely and asks only what it needs: is there a ranking
       * field, and which track do the rows come from. A board loaded by some
       * other package answers neither and is passed over, which is the right
       * outcome for one this page cannot describe.
       */
      const sourceOf = (board: unknown) =>
        (board as { from?: { track?: string; rank?: { field?: string } } }).from;

      // Only boards whose rows are computed and ordered. A board with literal
      // `items` and no `rank` is a table the organiser wrote by hand, and
      // calling row three of it "third place" would be putting words in their
      // mouth.
      const ranked = competition.leaderboards.filter(
        (board) => sourceOf(board)?.rank?.field,
      );
      if (!ranked.length) return null;

      const session = await getAuthSession();
      const viewer = session?.user ? resolveId(session.user) : undefined;

      // Config order decides the default, since that is the order the organiser
      // already put the boards in. A competitor who has entered a track beats
      // it: the standings they care about are the ones they are standing in.
      let board = ranked[0]!;
      if (viewer) {
        const entered = new Set(
          (await unsafe(enrolments.list({ user: viewer }))).map(
            (enrolment) => enrolment.track,
          ),
        );
        board =
          ranked.find((candidate) => {
            const track = sourceOf(candidate)?.track;
            return track && entered.has(track);
          }) ?? board;
      }

      const field = sourceOf(board)!.rank!.field!;
      const def = await unsafe(sdk.leaderboards.load(board.id));
      // Already grouped, ordered and trimmed by whichever package loaded them,
      // so position in this array is position on the board.
      const rows = (def.items ?? []) as Array<Record<string, Cell>>;

      const names = await participantNames(rows);

      const toEntry = (row: Record<string, Cell>, index: number) => {
        const participant = participantIdOf(row);

        return {
          // `rank` is only materialised as a column when the board's `shape`
          // asks for it. Falling back to the index is safe because the rows
          // arrive ordered.
          rank: Number(row.rank) || index + 1,
          competitor:
            participant ?
              (names.get(participant) ?? participant)
            : "Unknown",
          score: row[field] ?? null,
          isYou: !!viewer && participant === viewer,
        };
      };

      // Both halves read the participant the same way. Matching on `userId`
      // alone missed every board that writes the column `groupBy: user` gives
      // it, which is all of them, so nobody was ever shown their own row.
      const yourIndex =
        viewer ? rows.findIndex((row) => participantIdOf(row) === viewer) : -1;

      const from = sourceOf(board);
      const trackName =
        from?.track ?
          (competition.tracks.find((track) => track.id === from.track)?.name ??
            from.track)
        : undefined;
      const metric =
        board.shape.find((column) => column.id === field)?.name ?? field;

      return {
        leaderboardId: board.id,
        leaderboardName: board.name ?? board.label ?? board.id,
        caption: [trackName, metric].filter(Boolean).join(" · "),
        total: rows.length,
        top: rows.slice(0, limit).map(toEntry),
        you:
          yourIndex >= limit ?
            toEntry(rows[yourIndex]!, yourIndex)
          : undefined,
      };
    },
  );

/**
 * `sessionUserId` never reaches the server, which reads the caller from the
 * session. It is here to keep one signed-in competitor's cached standings apart
 * from the next's, since the same board highlights a different row for each.
 */
export function useCompetitionStandings(
  competitionId?: string,
  sessionUserId?: string,
) {
  const fetch = useServerFn(getCompetitionStandings);
  return useQuery({
    queryKey: ["competition-standings", competitionId, sessionUserId],
    queryFn:
      competitionId ? () => fetch({ data: { competitionId } }) : skipToken,
  });
}
