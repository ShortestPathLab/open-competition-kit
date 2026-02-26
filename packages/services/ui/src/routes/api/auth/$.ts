import { createFileRoute } from "@tanstack/react-router";
import { auth } from "src/lib/get-auth";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return await (await auth()).handler(request);
      },
      POST: async ({ request }: { request: Request }) => {
        return await (await auth()).handler(request);
      },
    },
  },
});
