import { createIsomorphicFn } from "@tanstack/react-start";

import { sharedConfig } from "./auth.shared-config";
import { configureUser } from "./configure-user";
import { BetterAuthOptions } from "better-auth";

const db = createIsomorphicFn()
  .client(async () => null as never)
  .server(async () => {
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
    database: await db(),
    plugins: [await tsCookies()],
  } satisfies BetterAuthOptions;
}
