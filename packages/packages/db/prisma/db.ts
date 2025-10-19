import { $, randomUUIDv7 } from "bun";
import { once } from "lodash-es";
import { config } from "sdk";
import { client } from "./client";
import { toPrisma } from "./toPrisma";

export const db = once(async () => {
  const { value } = await config.get();
  if (!value) throw new Error("No config");
  const { provider, url } = value.db as { provider: string; url: string };
  await toPrisma({ datasource: { provider, url } });
  // Set up db
  await $`bunx prisma generate --schema ${import.meta.dir}/schemas/schema.prisma`;
  await $`bunx prisma migrate dev --name ${randomUUIDv7()} --schema ${import.meta.dir}/schemas/schema.prisma`;
  //
  return await client();
});
