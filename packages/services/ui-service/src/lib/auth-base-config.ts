import { createIsomorphicFn } from "@tanstack/react-start";

import { sharedConfig } from "./auth.shared-config";
import { BetterAuthOptions } from "better-auth";
import { config, unsafe } from "@open-competition-kit/sdk";

const POSTGRES = new Set(["postgresql", "postgres", "pg"]);
const MYSQL = new Set(["mysql", "mariadb"]);

/**
 * Auth's tables live in their own Postgres schema, and this is not cosmetic.
 *
 * The kit's Prisma package runs `prisma db push --accept-data-loss` at startup,
 * which reconciles `public` against the schema it generates — and *drops* any
 * table there that it does not know about. better-auth's tables are not in that
 * schema, so sharing `public` means the kit silently deletes every user, session
 * and OAuth account on the next boot.
 *
 * Two migration systems, one database: give them a schema each. Same connection,
 * same backups, same transactions if we ever want them; no collision.
 */
const AUTH_SCHEMA = "auth";

/**
 * Auth stores to the same database the kit does.
 *
 * Auth sits deliberately outside OpenCompetitionKit's scope — the kit only keeps
 * client identifiers and secrets — so this does not go through the `db`
 * implementation point. It reads the same `db:` block from the config and hands
 * the connection straight to better-auth's native driver, which puts auth's
 * tables beside the kit's in one database rather than in a stray `auth.sqlite`.
 *
 * See docs/auth-database.md for why this beats writing a custom adapter.
 */
const database = createIsomorphicFn()
  .client(async () => null as never)
  .server(async () => {
    const { db } = await unsafe(config.get());
    const { provider = "", url } = (db ?? {}) as {
      provider?: string;
      url?: string;
    };
    const kind = provider.toLowerCase();

    if (url && POSTGRES.has(kind)) {
      const { Pool } = await import("pg");

      // Scope every connection to the auth schema via the startup `options`
      // parameter, so it is set before any query can run on the connection.
      //
      // The obvious alternative — an `on("connect")` handler that fires
      // `SET search_path` — races: pg does not await the handler, so better-auth
      // gets the fresh connection and issues its query while the un-awaited SET
      // is still in flight ("client is already executing a query"). A page load
      // opens several connections at once, so the race is routine, not rare, and
      // surfaces as auth requests that hang or fail with no response.
      const pool = new Pool({
        connectionString: url,
        options: `-c search_path=${AUTH_SCHEMA}`,
      });

      // Idempotent, and independent of search_path — so it works even on the
      // very first connection, when the schema it points at does not exist yet.
      await pool.query(`CREATE SCHEMA IF NOT EXISTS ${AUTH_SCHEMA}`);

      return pool;
    }

    if (url && MYSQL.has(kind)) {
      const { createPool } = await import("mysql2/promise");
      return createPool(url);
    }

    // Either there is no usable `db:` block, or it names a provider better-auth
    // has no native driver for. Fall back to a local SQLite file so a dev
    // instance still boots — but say so loudly, because silently diverging from
    // the configured database is how you end up with users in one store and
    // their enrolments in another.
    if (url) {
      console.warn(
        `[auth] No native better-auth driver for db provider "${provider}". ` +
          `Falling back to a local auth.sqlite, which does NOT share a database ` +
          `with the kit. See docs/auth-database.md.`,
      );
    }

    const { Database } = await import("bun:sqlite");
    return new Database("auth.sqlite");
  });

const tsCookies = createIsomorphicFn()
  .client(async () => null as never)
  .server(async () => {
    const { tanstackStartCookies } = await import("better-auth/tanstack-start");
    return tanstackStartCookies();
  });

export async function getAuthBaseConfig() {
  return {
    ...sharedConfig,
    database: await database(),
    plugins: [await tsCookies()],
  } satisfies BetterAuthOptions;
}
