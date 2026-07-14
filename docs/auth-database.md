# Getting the auth database into Postgres

**Question:** better-auth has Postgres support, but OpenCompetitionKit abstracts the
database behind its own `db` implementation point. Do we need to write a
better-auth ⇄ OCK adapter? Is that even possible?

**Answer:** It is possible, but you almost certainly should not do it. The problem
you actually have — *"auth data is in `auth.sqlite` and I want it in Postgres"* —
does not require an adapter at all.

---

## Where we are today

Auth lives entirely in the UI service and stores to a **separate bun:sqlite file**:

- `src/lib/auth-base-config.ts` — the better-auth database is `auth.sqlite`.
- `src/lib/get-auth.ts` — builds `betterAuth()` from the `auth:` block of the config.
- `src/lib/configure-user.ts` — mirrors the authenticated user into the kit's own
  `user` table and stores OAuth tokens as user secrets.

So there are two databases and no shared transaction. The mirror write in
`configure-user.ts` is the seam: if it fails, a user exists in auth but not in the kit.

## What a better-auth custom adapter actually demands

From `createAdapterFactory` (`@better-auth/core`, `src/db/adapter/`):

**Eight required methods** — `create`, `findOne`, `findMany`, `update`,
`updateMany`, `delete`, `deleteMany`, `count`.

- **`where` is a flat `CleanedWhere[]`** supporting eleven operators (`eq`, `ne`,
  `lt`, `lte`, `gt`, `gte`, `in`, `not_in`, `contains`, `starts_with`,
  `ends_with`), an `AND`/`OR` connector per clause, and case-insensitive matching.
- **`findMany` takes a mandatory `limit`**, plus optional `sortBy {field, direction}`
  and `offset`.
- **`update` must return the updated row**; `updateMany`/`deleteMany` return counts.
- **Joins are mandatory, and they are on the hot path.** Core issues
  `findOne({ model: "session", where: [...], join: { user: true } })` on *every
  authenticated request*. Ignore `join` and session resolution returns a session
  with no user, so nobody can log in. (It can be faked as an N+1 fetch-and-stitch,
  which is what the built-in memory adapter effectively does.)
- **Models must be dynamic.** Plugins add tables, users can rename tables and
  columns, and `additionalFields` adds columns. You cannot serve a fixed set.
- Transactions are **optional** (`transaction: false` substitutes a passthrough),
  but then `consumeOne`/`incrementOne` lose atomicity — which opens a race on
  single-use credentials (verification tokens, magic links, OAuth codes). Both are
  marked in the source as slated to become required.

Required core tables: `user`, `session`, `account`, `verification` (+ `rateLimit`
if rate limiting is DB-backed).

## What OCK's `db` implementation point offers

`packages/core/hook/db.ts:138`:

```ts
type Acc<T> = { collection: keyof typeof schemas; payload: T };

export const db = S.Struct({
  list: hook<Acc<any>, unknown>(),
  get: hook<Acc<string>, unknown>(),
  create: hook<Acc<any>, unknown>(),
  update: hook<Acc<any>, void>(),
  delete: hook<Acc<string>, void>(),
});
```

And the Prisma implementation is a straight passthrough — `list` is
`findMany({ where: payload })`, i.e. **equality matching only**.

The gap, point by point:

| better-auth needs | OCK has | Verdict |
|---|---|---|
| Arbitrary, dynamic models | `collection: keyof typeof schemas` — 7 hardcoded tables | **Blocker** |
| 11 `where` operators, AND/OR, case-insensitivity | equality-only partial match | **Blocker** |
| `sortBy`, `limit`, `offset`, `count` | none | **Blocker** |
| `updateMany`, `deleteMany`, update-by-`where` | update/delete by `id`, returning `void` | **Blocker** |
| `join` on every authed request | no join concept | Workable (N+1 in the adapter) |
| Atomic `consumeOne` | no transactions, no atomic ops | Security risk |
| `user` with email/emailVerified/image/timestamps | `user` is `{ name }` | Name collision |

Four of those are blockers, and every one of them is a change to *core*, not to a
package.

The one encouraging detail: `toPrisma.ts` **generates** `schema.prisma` from
`hook.db.schemas`, and the Prisma package resolves a collection by looking it up
on the client. So if the table registry were extensible, new tables would flow
through to Prisma automatically. The architecture is well positioned for it — it
is simply not built.

## The options

### A. Point better-auth at the same Postgres — *chosen, and implemented*

The config already carries the connection details:

```yaml
db:
  provider: postgresql
  url: postgres://…
```

They are read in `auth-base-config.ts` and handed to better-auth's **native**
Postgres driver instead of `auth.sqlite`. Auth gets its own tables in the same
Postgres database as the kit.

> **Auth's tables live in a separate Postgres schema (`auth`), and that is not
> cosmetic.**
>
> The `db/prisma` package runs `prisma db push --accept-data-loss` on startup,
> which reconciles `public` against the schema it generates — and **drops any
> table there it does not know about**. better-auth's tables are not in that
> schema. Sharing `public` therefore means the kit silently deletes every user,
> session and OAuth account on its next boot.
>
> This is not hypothetical: it happened during implementation. Auth worked, then
> the next process that touched Prisma destroyed it, and the symptom was
> `relation "session" does not exist` from an unrelated request.
>
> Two migration systems, one database, both assuming they own `public`. The fix
> is a schema each: the connection pool issues `SET search_path TO auth`, so
> better-auth's migrations create its tables out of Prisma's reach. Same
> database, same backups, no collision.

- **Effort:** roughly ten lines; replaces the bun:sqlite in `auth-base-config.ts`.
- **No adapter, no core changes, no custom query layer to keep correct.**
- Keeps the architecture you already chose: OCK abstracts *its* database; the
  frontend owns auth and picks the better-auth adapter matching the same `db:` block.
- **Cost:** auth's portability becomes better-auth's matrix (Postgres, MySQL,
  SQLite, MongoDB natively, plus Prisma/Drizzle) rather than Prisma's. In practice
  these overlap almost completely.
- Still two logical schemas in one database, so `configure-user.ts` stays. But
  one database means you *could* later make that mirror write transactional.

### B. Use better-auth's official Prisma adapter against the generated client

Emit better-auth's four models into the schema `toPrisma.ts` generates, then pass
the existing Prisma client to better-auth's `prismaAdapter`.

- One client, one connection pool, one migration step.
- Still **no custom adapter** — the Prisma adapter is maintained upstream.
- **Cost:** the UI service would import the `db/prisma` package directly, coupling
  the frontend to a specific db implementation and quietly undoing the abstraction.
  Plugin tables have to be added to the generated schema by hand.

### C. Write the better-auth ⇄ OCK adapter

Only this option makes auth storage follow the `db` implementation point, so that
swapping the db package also swaps where auth data lives.

To get there, core needs:

1. An **extensible table registry** — packages contribute schemas, instead of the
   fixed 7 in `hook/db.ts`.
2. A **real query interface** — operators, AND/OR, `sortBy`, `limit`, `offset`,
   `count`, `updateMany`, `deleteMany`, and `update` returning the row.
3. **Atomic `consumeOne`/`incrementOne`**, or an accepted race on single-use tokens.
4. Joins, or an N+1 stitch on every authenticated request.

That is a substantial core project, and it buys a property — "auth storage is
pluggable" — that you have already decided you do not want, having deliberately
moved auth out of OCK's scope.

## Recommendation

**Take option A.** It solves the stated problem directly, needs no adapter, and is
consistent with the decision you already made about auth's scope. Keep C on the
shelf; it only becomes interesting if auth ever has to run on a database that
Prisma supports and better-auth does not.

**Separately, and regardless of auth:** items (1) and (2) from option C are worth
doing on their own merits. The `db` hook's equality-only, unsorted, unlimited
query interface is why the leaderboard loader has to read every submission and job
into memory to rank them, and why the dashboard issues N+1 queries per submission.
Adding `sortBy`/`limit`/`count` to the `db` implementation point would fix both.
