import { Database } from "bun:sqlite";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { sharedConfig } from "./auth.shared-config";

export const config = {
  ...sharedConfig,
  database: new Database("auth.sqlite"),
  plugins: [tanstackStartCookies()],
};

export default betterAuth(config);
