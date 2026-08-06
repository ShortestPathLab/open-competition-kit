/**
 * The `db:` block, as this package reads it.
 *
 * Core declares that a competition has a database and nothing about how to reach
 * one, because reaching one is entirely this package's business. Before packages
 * could declare fields, `db` was an empty struct whose contents survived only
 * because unrecognised keys were preserved, which also meant a misspelled `url`
 * produced a connection attempt against nothing.
 */
import type { ConfigExtensions } from "@open-competition-kit/sdk";
import { z } from "zod";

export const db = z.object({
  /** Anything Prisma supports: `postgresql`, `mysql`, `sqlite`, and so on. */
  provider: z.string(),
  /** The connection string, passed to Prisma as `DATABASE_URL`. */
  url: z.string(),
});

export type Db = z.infer<typeof db>;

export const config = {
  db: {
    schema: db,
    group: { id: "db", label: "Database" },
    shape: [
      {
        id: "provider",
        label: "Provider",
        kind: "text",
        description:
          "The Prisma datasource provider, e.g. postgresql. Any provider Prisma supports will work.",
      },
      {
        id: "url",
        secret: true,
        label: "Connection URL",
        kind: "text",
        description:
          "Passed to Prisma as DATABASE_URL. Read this from the environment rather than committing it.",
      },
    ],
  },
} satisfies ConfigExtensions;
