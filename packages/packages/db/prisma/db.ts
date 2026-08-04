import { $ } from "bun";
import { once } from "es-toolkit";
import { config } from "@open-competition-kit/sdk";
import { client } from "./client";
import { toPrisma } from "./toPrisma";
import { PrismaPg } from "@prisma/adapter-pg";

export const db = once(async () => {
  const { value } = await config.get();
  if (!value) throw new Error("No config");
  const { provider, url } = value.db as { provider: string; url: string };
  try {
    await toPrisma({ datasource: { provider } });
    // Set up db
    await $`
    bunx --package prisma@7.8.0 prisma generate --schema ${import.meta.dir}/schemas/schema.prisma
    DATABASE_URL=${url} bunx --package prisma@7.8.0 prisma db push dev --accept-data-loss --schema ${import.meta.dir}/schemas/schema.prisma --config ${import.meta.dir}/prisma.config.ts
  `;
  } catch (e) {
    console.warn(
      "Error setting up database. Things might not work correctly.",
      e,
    );
  }
  //
  return await client(new PrismaPg({ connectionString: url }));
});
