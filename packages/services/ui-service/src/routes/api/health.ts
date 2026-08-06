import { createFileRoute } from "@tanstack/react-router";
import sdk, { unsafe } from "@open-competition-kit/sdk";

/**
 * Is this service up, and can it reach the things it needs?
 *
 * Unauthenticated on purpose. Everything that could ask this, a compose
 * healthcheck, a load balancer, a Kubernetes probe, asks before there is any
 * session to authenticate, so a check behind the admin guard is a check nothing
 * can use. The reply is deliberately dull for the same reason: whether the
 * database answers, and nothing about what is in it.
 *
 * The dashboard's `getServiceStatus` is a different question and stays where it
 * is. That one is about telling a restarted process from one that never went
 * away, it hands out a boot id, and it is only interesting to somebody who is
 * already an organiser.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        // Cheap and real. Reading the competition list goes through the config
        // and the database, which is the pair that actually breaks: a service
        // whose Postgres has gone away answers its own port perfectly well and
        // cannot serve a single page.
        const database = await unsafe(sdk.competitions.list({}))
          .then(() => true)
          .catch(() => false);

        return Response.json(
          { status: database ? "ok" : "degraded", database },
          {
            status: database ? 200 : 503,
            // A cached health check is a health check that lies.
            headers: { "cache-control": "no-store" },
          },
        );
      },
    },
  },
});
