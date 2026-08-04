import { createFileRoute } from "@tanstack/react-router";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { z } from "zod";
import {
  UPLOAD_NAMESPACE,
  maxUploadBytes,
  requireUser,
} from "@/lib/files.server";

const body = z.object({
  name: z.string().min(1).max(200),
  contentType: z.string().max(200).optional(),
  /** Declared by the client, and therefore not trusted — see below. */
  size: z.number().nonnegative().optional(),
});

/**
 * Claim a key for an upload that has not happened yet.
 *
 * Returns a presigned `url` when the storage backend can produce one, in which
 * case the browser PUTs the bytes straight to the bucket and the app server
 * never sees them. Otherwise `url` is null and the client posts to
 * `/api/files/upload`, which proxies.
 */
export const Route = createFileRoute("/api/files/request-upload")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const user = await requireUser();
          const input = body.parse(await request.json());
          const limit = await maxUploadBytes();

          // A declared size is a hint, not a guarantee: rejecting early saves an
          // upload that would be thrown away, but `commit` is what actually
          // enforces the limit, against the bytes that really arrived.
          if (input.size !== undefined && input.size > limit) {
            return Response.json(
              { error: `File exceeds the ${limit} byte limit.`, limit },
              { status: 413 },
            );
          }

          const { key, url } = await unsafe(
            sdk.files.reserve({
              owner: user.id,
              namespace: UPLOAD_NAMESPACE,
              name: input.name,
              contentType: input.contentType,
            }),
          );

          return Response.json({ key, url: url ?? null, limit });
        } catch (e) {
          if (e instanceof Response) return e;
          console.error("[files] request-upload failed", e);
          return Response.json({ error: "Upload failed" }, { status: 500 });
        }
      },
    },
  },
});
