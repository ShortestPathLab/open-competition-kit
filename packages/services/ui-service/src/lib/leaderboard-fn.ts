import { createServerFn, useServerFn } from "@tanstack/react-start";
import { skipToken, useQuery } from "@tanstack/react-query";
import sdk, { enrolments, unsafe, type $props } from "@open-competition-kit/sdk";
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

export const getLoadedLeaderboard = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: leaderboardId }) => {
    return (await unsafe(
      sdk.leaderboards.load(leaderboardId),
    )) as (typeof $props.leaderboard.ui)["def"];
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

type Cell = string | number | boolean | null;

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

      // Only boards whose rows are computed and ordered. A board with literal
      // `items` and no `rank` is a table the organiser wrote by hand, and
      // calling row three of it "third place" would be putting words in their
      // mouth.
      const ranked = competition.leaderboards.filter(
        (board) => board.from?.rank?.field,
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
          ranked.find(
            (candidate) =>
              candidate.from?.track && entered.has(candidate.from.track),
          ) ?? board;
      }

      const field = board.from!.rank!.field;
      const def = await unsafe(sdk.leaderboards.load(board.id));
      // Already grouped, ordered and trimmed by whichever package loaded them,
      // so position in this array is position on the board.
      const rows = (def.items ?? []) as Array<Record<string, Cell>>;

      const toEntry = (row: Record<string, Cell>, index: number) => ({
        // `rank` is only materialised as a column when the board's `shape` asks
        // for it. Falling back to the index is safe because the rows arrive
        // ordered.
        rank: Number(row.rank) || index + 1,
        competitor: String(row.user ?? row.userId ?? "Unknown"),
        score: row[field] ?? null,
        isYou: !!viewer && String(row.userId) === viewer,
      });

      const yourIndex =
        viewer ?
          rows.findIndex((row) => String(row.userId) === viewer)
        : -1;

      const trackName =
        board.from?.track ?
          (competition.tracks.find(
            (track) => track.id === board.from!.track,
          )?.name ?? board.from.track)
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
