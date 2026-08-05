import { Effect as E } from "effect";
import { keyOf, makeKey, toFileRef, type FileBody, type FileRef } from "../file";
import type { Namespace } from "../namespace";
import { FileTooLargeError, MissingFileError } from "./errors";
import type { HookRunner, Instance } from "./runtime";

/**
 * Large files.
 *
 * The bytes go to whichever package implements the `files` hooks. This layer owns
 * the parts a backend must not be trusted with: deriving the key, and recording
 * who the file belongs to so it can be found and reclaimed later.
 */
export const createFileStore = (hooks: HookRunner, instance: Instance) => {
  /**
   * The largest file the installed backend will take, in bytes, or undefined when
   * it named no ceiling. Read from the backend rather than the config, because the
   * figure is one of the backend's own settings.
   */
  const limit = () => hooks.do((h) => h.files.limit());

  const files = {
    /**
     * What the backend will accept, for a caller that wants to know before it
     * starts. Knowing early is what saves the upload: a browser handed this number
     * turns a file away locally, and the round trip never happens.
     */
    limit,

    /**
     * Claim a key for a file that does not exist yet.
     *
     * The key is derived here, never accepted from a caller: a caller-supplied key
     * is a path traversal, or an overwrite of somebody else's submission. The
     * ownership row is written before the bytes are, so an upload that dies midway
     * leaves a reclaimable record rather than an untracked object in the bucket.
     *
     * `url` is a presigned target the browser can PUT to directly. When the backend
     * cannot presign it is undefined and the caller must proxy through `put`.
     */
    reserve: ({
      owner,
      namespace,
      name,
      contentType,
      expiresIn,
    }: {
      owner: string;
      namespace: Namespace;
      name?: string;
      contentType?: string;
      expiresIn?: number;
    }) =>
      E.gen(function* () {
        const row = yield* instance.files.create({
          key: "",
          namespace,
          owner,
          name: name ?? "",
          size: 0,
          contentType: contentType ?? "",
          checksum: "",
        });

        const key = makeKey({ namespace, owner, id: row.id, name });
        yield* instance.files.update({ id: row.id, key });

        const url = yield* hooks.do((h) => h.files.link({ key, mode: "write", expiresIn }));

        return { key, id: row.id, url };
      }),

    /** Write bytes to a key already claimed by `reserve`. */
    put: ({ key, body, contentType }: { key: string; body: FileBody; contentType?: string }) =>
      hooks.do((h) => h.files.write({ key, body, contentType })),

    /**
     * Seal a reserved key and produce the reference to persist.
     *
     * A client that uploaded straight to the bucket says "done"; the server must
     * not take its word for it. This asks the backend what is actually there, then
     * rejects and deletes anything absent or over the limit.
     *
     * A presigned upload reaches the bucket without passing through any hook, so
     * this is the first server-side moment, and by then there is an object to
     * remove and an ownership row to take back.
     */
    commit: (key: string) =>
      E.gen(function* () {
        const meta = yield* hooks.do((h) => h.files.peek({ key }));
        const [row] = yield* instance.files.list({ key });

        if (!meta) {
          return yield* E.fail(new MissingFileError({ key }));
        }

        const ceiling = yield* limit();
        if (ceiling && meta.size > ceiling) {
          yield* hooks.do((h) => h.files.delete({ key })).pipe(E.catchAll(() => E.void));
          if (row) yield* instance.files.delete(row.id);
          return yield* E.fail(new FileTooLargeError({ key, size: meta.size, limit: ceiling }));
        }

        if (row) {
          yield* instance.files.update({
            id: row.id,
            size: meta.size,
            contentType: meta.contentType ?? row.contentType,
            checksum: meta.checksum ?? "",
          });
        }

        return toFileRef({ ...meta, key }, row?.name || undefined);
      }),

    /** Store bytes and return the reference to persist. Server-side path. */
    write: ({
      owner,
      namespace,
      body,
      name,
      contentType,
    }: {
      owner: string;
      namespace: Namespace;
      body: FileBody;
      name?: string;
      contentType?: string;
    }) =>
      E.gen(function* () {
        const { key } = yield* files.reserve({
          owner,
          namespace,
          name,
          contentType,
        });
        yield* files.put({ key, body, contentType });
        return yield* files.commit(key);
      }),

    /** Size, existence, checksum, without pulling the body. */
    peek: (file: FileRef | string) => hooks.do((h) => h.files.peek({ key: keyOf(file) })),

    read: (file: FileRef | string) => hooks.do((h) => h.files.read({ key: keyOf(file) })),

    /** A direct URL, when the backend can presign one. */
    link: (file: FileRef | string, mode: "read" | "write" = "read", expiresIn?: number) =>
      hooks.do((h) => h.files.link({ key: keyOf(file), mode, expiresIn })),

    delete: (file: FileRef | string) =>
      E.gen(function* () {
        const key = keyOf(file);
        yield* hooks.do((h) => h.files.delete({ key }));
        const rows = yield* instance.files.list({ key });
        yield* E.forEach(rows, (row) => instance.files.delete(row.id));
      }),

    /** Find ownership rows by key, by owner, or by namespace. */
    list: (partial: { key?: string; owner?: string; namespace?: string }) =>
      instance.files.list(partial as never),

    /** Every file belonging to an owner. */
    of: (owner: string) => instance.files.list({ owner }),

    /**
     * Reclaim an owner's files. Without this, deleting a submission leaks its
     * bytes into the backend permanently.
     */
    purge: (owner: string) =>
      E.gen(function* () {
        const rows = yield* instance.files.list({ owner });
        yield* E.forEach(rows, (row) =>
          E.gen(function* () {
            if (row.key) {
              yield* hooks
                .do((h) => h.files.delete({ key: row.key }))
                .pipe(E.catchAll(() => E.void));
            }
            yield* instance.files.delete(row.id);
          }),
        );
        return rows.length;
      }),
  };

  return files;
};
