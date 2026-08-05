import { Schema as S } from "effect";

export const FILE_REF = "open-competition-kit/file" as const;

/**
 * What actually goes in a database field.
 *
 * Binary data does not live in the database — a small, JSON-safe pointer to it
 * does. This is what lets a submission reference a 2GB model without the row,
 * the backups, or the runner's memory ever carrying the bytes.
 */
export const FileRef = S.Struct({
  $type: S.Literal(FILE_REF),
  /** Opaque and backend-scoped. Only the backend interprets it. */
  key: S.String,
  size: S.Number,
  name: S.optional(S.String),
  contentType: S.optional(S.String),
  /** sha256, so a consumer can verify the bytes it fetched are the bytes meant. */
  checksum: S.optional(S.String),
});

export type FileRef = S.Schema.Type<typeof FileRef>;

/** What a backend knows about a stored object without fetching its body. */
export type FileMeta = {
  key: string;
  size: number;
  contentType?: string;
  checksum?: string;
};

/** Anything a backend is expected to be able to store. */
export type FileBody = Uint8Array | ArrayBuffer | Blob | ReadableStream<Uint8Array> | string;

const isFileRef = S.is(FileRef);

export const isFile = (value: unknown): value is FileRef => isFileRef(value);

/** Accept either a ref or a bare key wherever a file is addressed. */
export const keyOf = (file: FileRef | string) => (typeof file === "string" ? file : file.key);

export const toFileRef = (meta: FileMeta, name?: string): FileRef => ({
  $type: FILE_REF,
  key: meta.key,
  size: meta.size,
  ...(name ? { name } : {}),
  ...(meta.contentType ? { contentType: meta.contentType } : {}),
  ...(meta.checksum ? { checksum: meta.checksum } : {}),
});

/**
 * Keys are derived, never taken from the client.
 *
 * A caller-supplied key is a path traversal and an overwrite of someone else's
 * submission waiting to happen, so the filename only ever contributes a
 * sanitised suffix; the owner and a random id do the rest of the work.
 */
export const makeKey = ({
  namespace,
  owner,
  id,
  name,
}: {
  namespace: string;
  owner: string;
  id: string;
  name?: string;
}) => {
  const scope = namespace.split("/").filter(Boolean).at(-1) ?? "file";
  const safe = (name ?? "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(-100);

  return `${scope}/${owner}/${id}/${safe || "file"}`;
};
