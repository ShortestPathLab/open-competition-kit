import { config, unsafe, type FileBody, type Package } from "@open-competition-kit/sdk";
import { S3Client } from "bun";
import { once } from "es-toolkit";
import { config as extensions } from "./config";

const DEFAULT_EXPIRY_SECONDS = 15 * 60;

/** Realm-safe: the request body's stream comes from the server runtime's realm,
 * so `instanceof ReadableStream` is false even when it plainly is one. */
const isStream = (b: unknown): b is ReadableStream =>
  !!b && typeof b === "object" && typeof (b as ReadableStream).getReader === "function";

type S3Config = {
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  /** Needed by MinIO and most non-AWS S3 implementations. */
  virtualHostedStyle?: boolean;
  /** How long a presigned URL stays valid. */
  expiresIn?: number;
  /** Largest object this backend will accept. */
  maxBytes?: number;
};

const settings = once(async (): Promise<S3Config> => {
  const c = await unsafe(config.get());
  return ((c.files as S3Config | undefined) ?? {}) as S3Config;
});

/**
 * The size ceiling, or undefined for none.
 *
 * Read per call rather than through `settings`, which is memoised for the
 * client's sake: credentials cannot change under a live connection, but this is
 * a number an organiser may want to lower without a restart.
 */
const maxBytes = async () => {
  const c = await unsafe(config.get());
  return (c.files as S3Config | undefined)?.maxBytes;
};

const client = once(async () => {
  const s = await settings();

  // Fall back to the conventional environment variables, so credentials can be
  // injected by the platform rather than written into the config file.
  const bucket = s.bucket ?? process.env.S3_BUCKET;
  const accessKeyId = s.accessKeyId ?? process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = s.secretAccessKey ?? process.env.S3_SECRET_ACCESS_KEY;

  if (!bucket) {
    throw new Error(
      "The S3 large-file backend needs a bucket. Set `files.bucket` in the " +
        "config, or S3_BUCKET in the environment.",
    );
  }

  return new S3Client({
    bucket,
    accessKeyId,
    secretAccessKey,
    sessionToken: s.sessionToken ?? process.env.S3_SESSION_TOKEN,
    region: s.region ?? process.env.S3_REGION,
    endpoint: s.endpoint ?? process.env.S3_ENDPOINT,
    virtualHostedStyle: s.virtualHostedStyle,
  });
});

export default {
  name: "@open-competition-kit/large-files-s3",
  config: extensions,
  description:
    "Stores Open Competition Kit large files in any S3-compatible bucket, using Bun's native S3 client. Presigns URLs so uploads and downloads bypass the app server.",
  version: "0.0.6",
  files: {
    write: async ({ key, body, contentType }) => {
      const s3 = await client();
      const limit = await maxBytes();

      // A ReadableStream must be wrapped, not coerced: passed raw it stringifies
      // to "[object ReadableStream]" and silently stores 23 bytes.
      const payload: FileBody | Response = isStream(body) ? new Response(body) : body;

      const size = await s3.write(key, payload as Blob, { type: contentType });

      // The object is already in the bucket by now, since `write` reports the
      // size it stored rather than being asked in advance. Removing it is the
      // difference between a refusal and a refusal that still bills the
      // organiser every month.
      if (limit && size > limit) {
        await s3.delete(key).catch(() => undefined);
        throw new Error(
          `File is ${size} bytes, and this storage backend accepts at most ${limit}.`,
        );
      }

      // Deliberately no checksum. Computing sha256 would mean streaming the whole
      // object back out of the bucket, which defeats the point of storing it
      // there; S3 already guarantees integrity in transit, and the ETag is
      // returned by `stat`. Consumers that need a content hash should have the
      // producer supply one.
      return { key, size, contentType };
    },

    read: async ({ key }) => {
      const s3 = await client();
      const file = s3.file(key);

      if (!(await file.exists())) {
        throw new Error(`No such file: ${key}`);
      }

      return file.stream();
    },

    peek: async ({ key }) => {
      const s3 = await client();

      try {
        const { size, type, etag } = await s3.stat(key);
        return {
          key,
          size,
          contentType: type,
          // The ETag is a content hash only for single-part uploads, so it is not
          // a sha256 and must not be presented as one.
          checksum: etag,
        };
      } catch {
        return undefined;
      }
    },

    delete: async ({ key }) => {
      const s3 = await client();
      await s3.delete(key);
    },

    /**
     * The reason to run this backend: the browser talks to the bucket directly,
     * so a multi-gigabyte model upload never touches the app server, and no
     * shared volume has to exist between the UI and the runner.
     */
    link: async ({ key, mode, expiresIn }) => {
      const s3 = await client();
      const s = await settings();

      return s3.presign(key, {
        method: mode === "write" ? "PUT" : "GET",
        expiresIn: expiresIn ?? s.expiresIn ?? DEFAULT_EXPIRY_SECONDS,
      });
    },

    limit: maxBytes,
  },
} satisfies Package;
