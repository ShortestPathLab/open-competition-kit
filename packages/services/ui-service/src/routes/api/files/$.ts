import { createFileRoute } from "@tanstack/react-router";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { requireOwnedFile } from "src/lib/files.server";

/**
 * Download a stored file.
 *
 * When the backend can presign, this redirects and the bytes come straight from
 * the bucket. Otherwise it streams them through, so the local backend still works
 * — just without the app server getting out of the way.
 */
export const Route = createFileRoute("/api/files/$")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { _splat?: string } }) => {
        try {
          const key = params._splat;
          if (!key) return new Response("Missing key", { status: 400 });

          const { row } = await requireOwnedFile(key);

          const url = await unsafe(sdk.files.link(key, "read"));
          if (url) return Response.redirect(url, 302);

          const stream = await unsafe(sdk.files.read(key));

          return new Response(stream as ReadableStream, {
            headers: {
              "content-type": row.contentType || "application/octet-stream",
              "content-length": String(row.size),
              "content-disposition": `attachment; filename="${(row.name || "download").replace(/"/g, "")}"`,
            },
          });
        } catch (e) {
          if (e instanceof Response) return e;
          console.error("[files] download failed", e);
          return new Response("Download failed", { status: 500 });
        }
      },
    },
  },
});
