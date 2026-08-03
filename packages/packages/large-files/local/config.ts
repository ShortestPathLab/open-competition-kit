/**
 * The `files:` fields this backend reads.
 *
 * All of them, including the size ceiling. Where the bytes land and how many of
 * them this backend will take are the same kind of setting: a filesystem has a
 * disk behind it, and how much of that disk a competition may fill is a fact
 * about this backend rather than about competitions.
 *
 * Declaring them here means a mistyped `root` stops the app at boot rather than
 * quietly writing every submission to the default directory.
 */
import type { ConfigExtensions } from "@open-competition-kit/sdk";
import { z } from "zod";

export const files = z.object({
  /**
   * Directory the files live under. Defaults to the `LARGE_FILES_ROOT`
   * environment variable, then to `/data/files`.
   */
  root: z.string().optional(),
  /**
   * Largest file this backend will accept, in bytes. Absent means no ceiling,
   * which on a filesystem means the disk is the ceiling.
   */
  maxBytes: z.number().positive().optional(),
});

export const config = {
  files: {
    schema: files,
    group: { id: "files", label: "File storage" },
    shape: [
      {
        id: "root",
        label: "Storage root",
        kind: "text",
        description:
          "Directory submissions are written to. Every service that reads or writes them must mount the same volume at this path: the UI writes and the runner reads.",
      },
      {
        id: "maxBytes",
        label: "Largest file",
        kind: "number",
        description:
          "Bytes. An upload past this is refused, and one that reached the disk anyway is deleted. Leave it out and the disk decides, which it does by filling up.",
      },
    ],
  },
} satisfies ConfigExtensions;
