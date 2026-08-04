import sdk, {
  jobs,
  outputs,
  reference,
  submissions,
  unsafe,
  users,
  type Leaderboard,
} from "@open-competition-kit/sdk";
import { groupBy as groupRows } from "es-toolkit";
import { leaderboardSource, type LeaderboardSource } from "./config";

type Value = string | number | boolean | null;
export type Row = Record<string, Value>;

/**
 * A job counts once it has come to rest. Runners invent their own vocabulary for
 * success (`standard` says "completed", the FIT5047 runner says "done"), so we
 * exclude the words meaning "not yet" or "never" instead of listing the rest.
 */
const UNFINISHED = new Set(["pending", "running", "queued", "prepared"]);
const FAILED = new Set(["failed", "error", "cancelled", "timeout"]);

const isValue = (v: unknown): v is Value =>
  v === null ||
  typeof v === "string" ||
  typeof v === "number" ||
  typeof v === "boolean";

const toIso = (v: unknown) =>
  v instanceof Date ? v.toISOString()
  : typeof v === "string" ? v
  : null;

/**
 * Turn one job output into zero or more leaderboard rows.
 *
 * Runners store outputs in whatever shape suits them, so we accept the three that
 * occur in practice: a scalar, an object of scalars, or an array of either (a
 * runner evaluating against N test cases emits N rows). Nested values are
 * stringified rather than dropped, so nothing vanishes from a board unnoticed.
 */
export function toRows(value: unknown): Row[] {
  // Often stored as a JSON string (`standard` writes them with JSON.stringify),
  // so unwrap one layer before deciding what we have.
  if (typeof value === "string") {
    try {
      return toRows(JSON.parse(value) as unknown);
    } catch {
      return [{ value }];
    }
  }

  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(toRows);
  if (isValue(value)) return [{ value }];
  if (typeof value !== "object") return [];

  const row: Row = {};
  for (const [k, raw] of Object.entries(value as Record<string, unknown>)) {
    row[k] = isValue(raw) ? raw : JSON.stringify(raw);
  }
  return [row];
}

const compare = (a: Value | undefined, b: Value | undefined) => {
  const [x, y] = [Number(a), Number(b)];
  if (!Number.isNaN(x) && !Number.isNaN(y)) return x - y;
  return String(a ?? "").localeCompare(String(b ?? ""));
};

const groupKeyOf = (row: Row, groupBy: LeaderboardSource["groupBy"]) => {
  switch (groupBy ?? "user") {
    case "none":
      return undefined;
    case "job":
      return String(row.job);
    case "submission":
      return String(row.submission);
    default:
      return String(row.userId ?? row.user);
  }
};

/** Gather every finished job's output across the selected tracks. */
async function collect(competition: string, from: LeaderboardSource) {
  const config = await unsafe(sdk.config.get());
  const owner = config.competitions.find((c) => c.id === competition);
  if (!owner) return [];

  const trackIds =
    from.track ? [from.track] : owner.tracks.map((track) => track.id);
  const outputReference = from.output ?? reference.std.output;
  const names = new Map<string, string>();
  const rows: Row[] = [];
  let finished = 0;

  for (const track of trackIds) {
    for (const submission of await unsafe(submissions.list({ track }))) {
      for (const job of await unsafe(jobs.list({ submission: submission.id }))) {
        if (UNFINISHED.has(job.status) || FAILED.has(job.status)) continue;
        finished++;

        const output = await unsafe(
          outputs.get({ owner: job.id, reference: outputReference }),
        ).catch(() => undefined);

        const produced = toRows(output);
        if (!produced.length) continue;

        if (!names.has(submission.user)) {
          const user = await unsafe(users.get(submission.user)).catch(
            () => undefined,
          );
          names.set(submission.user, user?.name || submission.user);
        }

        for (const produce of produced) {
          rows.push({
            user: names.get(submission.user) ?? submission.user,
            userId: submission.user,
            submission: submission.id,
            job: job.id,
            track,
            status: job.status,
            submittedAt: toIso(submission.createdAt),
            ranAt: toIso(job.createdAt),
            // Last, so a runner that emits its own `user`/`track` column wins.
            ...produce,
          });
        }
      }
    }
  }

  // Finished jobs but nothing to show means `output:` names a reference no runner
  // on these tracks writes. Every other layer treats an empty board as a valid
  // answer, so this is the only place that can say otherwise.
  if (finished && !rows.length) {
    console.warn(
      `[standard] ${finished} finished job(s) on ${trackIds.join(", ")} but ` +
        `no output stored under ${outputReference}.`,
    );
  }

  return rows;
}

/** Collapse each group down to a single winning row. */
export function select(rows: Row[], from: LeaderboardSource) {
  if ((from.groupBy ?? "user") === "none") return rows;

  const groups = groupRows(rows, (row) => groupKeyOf(row, from.groupBy) ?? "");
  const descending = (from.rank?.order ?? "desc") === "desc";

  return Object.values(groups).map((group) => {
    if (group.length === 1) return group[0]!;

    if ((from.select ?? "best") === "latest") {
      return group.reduce((a, b) =>
        compare(a.ranAt ?? a.submittedAt, b.ranAt ?? b.submittedAt) >= 0 ? a : b,
      );
    }

    const field = from.rank?.field;
    if (!field) return group[0]!;

    return group.reduce((a, b) => {
      const d = compare(a[field], b[field]);
      return (descending ? d >= 0 : d <= 0) ? a : b;
    });
  });
}

/** Order the winners, trim to `limit`, and number them. */
export function rank(
  winners: Row[],
  from: LeaderboardSource,
  shape: readonly { id: string }[],
) {
  const rows = [...winners];
  const field = from.rank?.field;

  if (field) {
    const descending = (from.rank?.order ?? "desc") === "desc";
    rows.sort((a, b) => {
      const d = compare(a[field], b[field]);
      return descending ? -d : d;
    });
  }

  const limited = from.limit && from.limit > 0 ? rows.slice(0, from.limit) : rows;

  // A `rank` column is the one thing a row cannot compute for itself, since it
  // only exists relative to the others. Fill it in unless the runner already did.
  const wantsRank = shape.some((s) => s.id === "rank");
  return limited.map((row, i) =>
    wantsRank && row.rank === undefined ? { ...row, rank: i + 1 } : row,
  );
}

/**
 * Build a leaderboard's rows from the outputs its competition's jobs produced.
 * Returns the config's literal `items` untouched when no `from` is declared, so
 * static and computed boards can coexist.
 */
export async function load(def: Leaderboard, competition: string) {
  // `from` is this package's field, not core's, so it is read back through the
  // schema that declared it. A board configured for some other loader has no
  // `from` here and falls through to its literal rows.
  const parsed = leaderboardSource.optional().safeParse(
    (def as { from?: unknown }).from,
  );
  const from = parsed.success ? parsed.data : undefined;

  if (!from) return [...(def.items ?? [])] as Row[];

  return rank(select(await collect(competition, from), from), from, def.shape);
}
