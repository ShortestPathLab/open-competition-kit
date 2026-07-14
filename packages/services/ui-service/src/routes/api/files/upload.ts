import { createFileRoute } from "@tanstack/react-router";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { requireOwnedFile } from "src/lib/files.server";

/**
 * Proxy an upload through the app, for backends that cannot presign — the local
 * filesystem has no URL a browser can reach.
 *
 * The key must already have been claimed by `request-upload`, and must belong to
 * the caller: this endpoint takes a key from the request, so it has to check.
 * The body is streamed rather than buffered, so the app's memory does not scale
 * with the size of the submission.
 */
export const Route = createFileRoute("/api/files/upload")({
  server: {
    handlers: {
      PUT: async ({ request }: { request: Request }) => {
        try {
          const key = new URL(request.url).searchParams.get("key");
          if (!key) {
            return Response.json({ error: "Missing key" }, { status: 400 });
          }

          const { row } = await requireOwnedFile(key);

          if (row.size > 0) {
            // A reserved key is single-use. Allowing a rewrite would let a
            // participant swap the bytes after a submission had been evaluated.
            return Response.json(
              { error: "This upload has already been completed." },
              { status: 409 },
            );
          }

          if (!request.body) {
            return Response.json({ error: "Empty body" }, { status: 400 });
          }

          await unsafe(
            sdk.files.put({
              key,
              body: request.body,
              contentType:
                request.headers.get("content-type") ??
                row.contentType ??
                undefined,
            }),
          );

          return Response.json({ ok: true });
        } catch (e) {
          if (e instanceof Response) return e;
          console.error("[files] upload failed", e);
          return Response.json({ error: "Upload failed" }, { status: 500 });
        }
      },
    },
  },
});
