import {
  config,
  unsafe,
  type FileBody,
  type FileMeta,
  type Package,
} from "@open-competition-kit/sdk";
import { once } from "es-toolkit";
import { createHash } from "node:crypto";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

const DEFAULT_ROOT = "/data/files";

type LargeFilesConfig = { root?: string };

const root = once(async () => {
  const c = await unsafe(config.get());
  const declared = (c.largeFiles as LargeFilesConfig | undefined)?.root;
  const dir = resolve(declared ?? process.env.LARGE_FILES_ROOT ?? DEFAULT_ROOT);

  await mkdir(dir, { recursive: true });

  // Fail loudly at startup rather than per-job. The UI service writes and the
  // runner reads, so if the volume is not mounted into both, every job fails
  // with "file not found" and the cause is nowhere near the symptom.
  try {
    const probe = join(dir, ".ock-write-probe");
    await Bun.write(probe, "");
    await rm(probe, { force: true });
  } catch (cause) {
    throw new Error(
      `Large file root "${dir}" is not writable. Every service that reads or ` +
        `writes submissions must mount the same volume at this path.`,
      { cause },
    );
  }

  return dir;
});

/**
 * Resolve a key to a path *inside* the root.
 *
 * Keys are derived by core rather than supplied by clients, but a storage
 * backend is the wrong place to assume that: one `../` here rewrites arbitrary
 * files on the host.
 */
async function pathFor(key: string) {
  const dir = await root();
  const target = resolve(join(dir, key));

  if (target !== dir && !target.startsWith(dir + sep)) {
    throw new Error(`Refusing to resolve key outside the storage root: ${key}`);
  }

  return target;
}

const metaFor = async (key: string, path: string): Promise<FileMeta> => {
  const { size } = await stat(path);
  const hash = createHash("sha256");

  // Hash by streaming: a submission may be far larger than memory.
  const stream = Bun.file(path).stream();
  for await (const chunk of stream) hash.update(chunk);

  return { key, size, checksum: hash.digest("hex") };
};

/**
 * `Bun.write` takes bytes, blobs and strings — but not a `ReadableStream`, which
 * it coerces with `String(...)`, writing the 23 bytes of "[object ReadableStream]"
 * and reporting success. Wrapping the stream in a `Response` is what makes it
 * stream to disk instead.
 */
/** Realm-safe: the request body's stream comes from the server runtime's realm,
 * so `instanceof ReadableStream` is false even when it plainly is one. */
const isStream = (b: unknown): b is ReadableStream =>
  !!b &&
  typeof b === "object" &&
  typeof (b as ReadableStream).getReader === "function";

const store = (path: string, body: FileBody) =>
  isStream(body) ?
    Bun.write(path, new Response(body))
  : Bun.write(path, body as Blob);

export default {
  name: "@open-competition-kit/large-files-local",
  description:
    "Stores Open Competition Kit large files on the local filesystem. The default backend.",
  version: "0.0.6",
  files: {
    write: async ({ key, body, contentType }) => {
      const path = await pathFor(key);
      await mkdir(dirname(path), { recursive: true });

      await store(path, body);

      return { ...(await metaFor(key, path)), contentType };
    },

    read: async ({ key }) => {
      const path = await pathFor(key);
      const file = Bun.file(path);

      if (!(await file.exists())) {
        throw new Error(`No such file: ${key}`);
      }

      return file.stream();
    },

    peek: async ({ key }) => {
      const path = await pathFor(key);
      if (!(await Bun.file(path).exists())) return undefined;
      return await metaFor(key, path);
    },

    delete: async ({ key }) => {
      await rm(await pathFor(key), { force: true });
    },

    // The local filesystem has no URL a browser can reach, so the caller proxies
    // the bytes through the app. This is the reason the S3 backend exists.
    link: async () => undefined,
  },
} satisfies Package;
