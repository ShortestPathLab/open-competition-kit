import { $ } from "bun";
import { once } from "lodash-es";
import { config } from "sdk";
import { PrismaClient } from "./generated/client";
import { toPrisma } from "./toPrisma";

export const db = once(async () => {
  const { value } = await config.get();
  if (!value) throw new Error("No config");
  const { provider, url } = value.db as { provider: string; url: string };
  await toPrisma({ datasource: { provider, url } });
  // Set up db;
  await $`bunx prisma generate --schema ${import.meta.dir}/schemas/schema.prisma`;
  return new PrismaClient();
});
