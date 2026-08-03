/**
 * The `largeFiles:` fields this backend reads.
 *
 * Core owns `maxBytes`, since it rejects an oversized upload before any backend
 * sees it. Everything else about where the bytes land is this package's, and
 * declaring it means a mistyped `root` stops the app at boot rather than quietly
 * writing every submission to the default directory.
 */
import type { ConfigExtensions } from "@open-competition-kit/sdk";
import { z } from "zod";

export const largeFiles = z.object({
  /**
   * Directory the files live under. Defaults to the `LARGE_FILES_ROOT`
   * environment variable, then to `/data/files`.
   */
  root: z.string().optional(),
});

export const config = {
  largeFiles: {
    schema: largeFiles,
    group: { id: "largeFiles", label: "File storage" },
    shape: [
      {
        id: "root",
        label: "Storage root",
        kind: "text",
        description:
          "Directory submissions are written to. Every service that reads or writes them must mount the same volume at this path: the UI writes and the runner reads.",
      },
    ],
  },
} satisfies ConfigExtensions;
