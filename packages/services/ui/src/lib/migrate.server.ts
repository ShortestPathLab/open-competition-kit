import { createServerOnlyFn } from "@tanstack/react-start";
import { getAuthBaseConfig } from "./auth-base-config";

export const migrate = createServerOnlyFn(async () => {
  const baseAuthConfig = await getAuthBaseConfig();
  const { getMigrations } = await import("better-auth/db");
  const { runMigrations } = await getMigrations(baseAuthConfig);
  await runMigrations();
});
