import { createMiddleware, createServerOnlyFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "src/lib/get-auth";

export const getAuthSession = createServerOnlyFn(async () => {
  const headers = getRequestHeaders();
  return await (await auth()).api.getSession({ headers });
});

export const ensureAuthSession = createServerOnlyFn(async () => {
  const headers = getRequestHeaders();
  const session = await (await auth()).api.getSession({ headers });
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
});

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();

  // Fetch the session using the request headers
  const session = await (await auth()).api.getSession({ headers });

  // Reject the request if no valid session is found
  if (!session) {
    throw new Error("Unauthorized");
  }

  // Pass the session into the context for subsequent middleware or server functions
  return next({ context: { session } });
});
