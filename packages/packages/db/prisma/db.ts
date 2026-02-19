import { $, randomUUIDv7 } from "bun";
import { once } from "lodash-es";
import { config } from "sdk";
import { client } from "./client";
import { toPrisma } from "./toPrisma";
import { PrismaPg } from "@prisma/adapter-pg";

export const db = once(async () => {
  const { value } = await config.get();
  if (!value) throw new Error("No config");
  const { provider, url } = value.db as { provider: string; url: string };
  await toPrisma({ datasource: { provider } });
  // Set up db
  await $`bunx prisma generate --schema ${import.meta.dir}/schemas/schema.prisma`;
  await $`bunx prisma format --schema ${import.meta.dir}/schemas/schema.prisma`;
  await $`DATABASE_URL=${url} bunx prisma migrate dev --name ${randomUUIDv7()} --schema ${import.meta.dir}/schemas/schema.prisma --config ${import.meta.dir}/prisma.config.ts`;
  //
  return await client(new PrismaPg({ connectionString: url }));
});
