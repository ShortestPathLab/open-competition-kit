/**
 * The `files:` fields this backend reads.
 *
 * Every one of them falls back to the conventional environment variable, so
 * credentials can be injected by the platform instead of written into a file
 * that gets committed. That is also why none of them are required here: a config
 * that names only the bucket is complete, and the check that a bucket was found
 * at all belongs at connect time, where the environment has been consulted.
 */
import type { ConfigExtensions } from "@open-competition-kit/sdk";
import { z } from "zod";

export const files = z.object({
  bucket: z.string().optional(),
  region: z.string().optional(),
  endpoint: z.string().optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  sessionToken: z.string().optional(),
  /** Needed by MinIO and most non-AWS S3 implementations. */
  virtualHostedStyle: z.boolean().optional(),
  /** How long a presigned URL stays valid, in seconds. */
  expiresIn: z.number().positive().optional(),
  /**
   * Largest object this backend will accept, in bytes. Absent means no ceiling,
   * which with a bucket means the bill is the ceiling.
   */
  maxBytes: z.number().positive().optional(),
});

export const config = {
  files: {
    schema: files,
    group: { id: "files", label: "File storage" },
    shape: [
      {
        id: "bucket",
        label: "Bucket",
        kind: "text",
        description: "Falls back to the S3_BUCKET environment variable.",
      },
      {
        id: "region",
        label: "Region",
        kind: "text",
        description: "Falls back to S3_REGION.",
      },
      {
        id: "endpoint",
        label: "Endpoint",
        kind: "text",
        description:
          "Falls back to S3_ENDPOINT. Set this for MinIO or any non-AWS implementation.",
      },
      {
        id: "virtualHostedStyle",
        label: "Virtual hosted style",
        kind: "boolean",
        description:
          "Needed by MinIO and most non-AWS S3 implementations. Leave off for AWS.",
      },
      {
        id: "expiresIn",
        label: "Presigned URL lifetime",
        kind: "number",
        description:
          "Seconds a presigned upload or download URL stays valid. Long enough for a large file on a slow connection.",
      },
      {
        id: "maxBytes",
        label: "Largest file",
        kind: "number",
        description:
          "Bytes. An object past this is refused and deleted from the bucket. A presigned upload goes straight to S3, so the check lands when the upload is sealed rather than when it starts.",
      },
      {
        id: "accessKeyId",
        label: "Access key ID",
        kind: "text",
        description:
          "Falls back to S3_ACCESS_KEY_ID. Prefer the environment: this file is usually committed.",
      },
      {
        id: "secretAccessKey",
        label: "Secret access key",
        kind: "text",
        description: "Falls back to S3_SECRET_ACCESS_KEY. Prefer the environment.",
      },
      {
        id: "sessionToken",
        label: "Session token",
        kind: "text",
        description: "Falls back to S3_SESSION_TOKEN. Only for temporary credentials.",
      },
    ],
  },
} satisfies ConfigExtensions;
