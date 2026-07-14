import { createIsomorphicFn } from "@tanstack/react-start";

import { sharedConfig } from "./auth.shared-config";
import { BetterAuthOptions } from "better-auth";
import { config, unsafe } from "@open-competition-kit/sdk";

const POSTGRES = new Set(["postgresql", "postgres", "pg"]);
const MYSQL = new Set(["mysql", "mariadb"]);

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
      return new Pool({ connectionString: url });
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
