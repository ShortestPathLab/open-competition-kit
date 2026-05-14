import { createAuthClient } from "better-auth/react";
import { sharedConfig } from "./auth.shared-config";

export const authClient = createAuthClient({
  ...sharedConfig,
});
