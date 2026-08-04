import { createFileRoute } from "@tanstack/react-router";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { z } from "zod";
import { requireOwnedFile } from "@/lib/files.server";

const body = z.object({ key: z.string().min(1) });

/**
 * Seal an upload and hand back the `FileRef` to store in the form value.
 *
 * The client says "done"; this does not take its word for it. `commit` asks the
 * storage backend what is actually there, and rejects — and deletes — anything
 * absent or over the size limit. Without this step a client could claim a key,
 * upload nothing, and submit a reference to a file that does not exist.
 */
export const Route = createFileRoute("/api/files/complete-upload")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const { key } = body.parse(await request.json());
          await requireOwnedFile(key);

          const ref = await unsafe(sdk.files.commit(key));

          return Response.json(ref);
        } catch (e) {
          if (e instanceof Response) return e;

          const message = e instanceof Error ? e.message : String(e);
          const tooLarge = message.includes("FileTooLarge");

          console.error("[files] complete-upload failed", e);
          return Response.json(
            { error: tooLarge ? "File is too large." : "Upload failed" },
            { status: tooLarge ? 413 : 400 },
          );
        }
      },
    },
  },
});
