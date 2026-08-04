import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/get-auth";

/**
 * Auth setup — the pool, the migrations — used to fail silently: the request
 * hung for a couple of seconds and then died with no response body and nothing
 * in the server console. Catch it here so the cause is actually visible.
 */
const handle = async (request: Request) => {
  try {
    return await (await auth()).handler(request);
  } catch (e) {
    console.error("[auth] request handler failed:", e);

    const production = process.env.NODE_ENV === "production";
    return new Response(
      JSON.stringify({
        error: "Auth handler failed",
        // No internals in production; in dev, seeing what broke is the point.
        detail:
          production ? undefined
          : e instanceof Error ? (e.stack ?? e.message)
          : String(e),
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
};

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => handle(request),
      POST: async ({ request }: { request: Request }) => handle(request),
    },
  },
});
