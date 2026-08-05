# Large file storage — design

**Status: implemented and adopted.** Submissions no longer base64 their source
into Postgres.

- `FileRef` and the `files` implementation point — `packages/core/file.ts`,
  `packages/core/hook/index.ts`
- the `file` ownership table, key derivation, `reserve`/`put`/`commit`, and
  `purge`-based garbage collection — `packages/core/open-competition-kit.ts`
- `@open-competition-kit/large-files-local` and
  `@open-competition-kit/large-files-s3` (Bun's native S3 client)
- the upload path — `/api/files/*` in the UI service, and a `kind: file` field in
  `@open-competition-kit/form-json`
- `integration/github-classic` writes a `FileRef`; `standard` and the FIT5047
  runner read it, and both still fall back to the legacy base64 context value so
  jobs created before the migration keep running

## The problem

Binary data currently lives base64-encoded inside Postgres.

`integration/github-classic` downloads the participant's selected branch as a zip
and writes it into the `context` table as a base64 string:

```ts
const archive = Buffer.from(data as ArrayBuffer);
if (archive.byteLength > MAX_SUBMISSION_ARCHIVE_BYTES) throw new Error(…);

await kit.jobs.context.set({
  owner: jobRecord.id,
  reference: reference.std.submissionSourceCodeZipB64,
  value: archive.toString("base64"),
});
```

The runner then reads the string back and unzips it in memory. There is a hard
10&nbsp;MB cap, and that cap exists because the approach does not survive being
relaxed.

What this costs:

- **Base64 inflates by ~33%.** A 10&nbsp;MB zip is a 13.3&nbsp;MB row.
- **No streaming anywhere.** Every read materialises the whole archive in memory,
  in both the UI service and the runner.
- **Backups and replication carry every submission's bytes**, forever.
- **The browser can never talk to storage directly**, so every upload and download
  is proxied through the app server.
- **Storage is welded to the database choice**, which is the exact opposite of
  "bring your own database".

It also means the kit cannot support the competition shape where a submission _is_
a large artifact — a trained model, a dataset, a compiled binary.

## The shape of the fix

Three pieces: a **reference** that goes in the database, an **implementation point**
that moves bytes, and an **upload path** that keeps those bytes out of the RPC layer.

### 1. `FileRef` — what the database actually stores

A serialisable pointer, stored wherever the base64 string is stored today:

```ts
export type FileRef = {
  $type: "open-competition-kit/file";
  /** Opaque, backend-scoped. e.g. "jobs/<id>/source.zip" */
  key: string;
  size: number;
  contentType?: string;
  /** sha256, so a runner can verify what it fetched. */
  checksum?: string;
};
```

This is what the design deck meant by _"database fields can contain a reference to
a large file"_. It is small, JSON-safe, and survives the existing `context`/JSON
columns with no schema change.

### 2. `files.*` — the implementation point

A new hook group in `packages/core/hook/index.ts`, alongside `db`:

```ts
files: S.Struct({
  /** Store bytes, return the reference to put in the database. */
  write: hook<{ key: string; body: Uint8Array | ReadableStream; contentType?: string }, FileRef>(),
  /** Stream bytes back out. */
  read: hook<{ key: string }, ReadableStream>(),
  /** Size / existence / checksum, without fetching the body. */
  peek: hook<{ key: string }, FileMeta | undefined>(),
  delete: hook<{ key: string }, void>(),
  /**
   * A URL the browser can use directly — presigned upload or download.
   * Backends that cannot do this return undefined and the app proxies instead.
   */
  link: hook<{ key: string; mode: "read" | "write"; expiresIn?: number }, string | undefined>(),
}),
```

This mirrors the deck's `large-file/write`, `large-file/read`, `large-file/peak`.

**On streams and serialisability.** These hooks pass `ReadableStream`s, which do not
serialise, so they cannot cross a language boundary. That is fine and consistent:
the `db` hook already passes non-serialisable values around. Both are
_infrastructure_ implementation points, in-process by definition. The
extension points that packages and third parties actually reach for — forms,
runners, leaderboards — stay serialisable.

**`link()` is the important one.** It is what lets an S3-backed deployment hand the
browser a presigned URL so a 2&nbsp;GB model upload never touches the app server.
Backends that cannot presign return `undefined`, and the service falls back to
proxying through its own endpoint. Every backend stays usable; good backends get to
be fast.

### 3. Ownership and lifecycle

Add a `file` table to the registry, alongside `context`:

```ts
file: createSchemas("open-competition-kit/db/file", {
  key: S.String,
  namespace: S.String, // job | user | submission — reuse the existing namespaces
  owner: S.String,
  size: Int,
  checksum: S.String,
  contentType: S.String,
});
```

Files become owned objects rather than loose blobs, which gives us:

- **Garbage collection** — deleting a submission deletes its files. Without this,
  orphaned bytes accumulate silently and forever.
- **Quotas** — per-track maximum file size and per-user total, enforced in `write`.
- **Auditability** — "what is this competition storing, and how much".

## The two backends

### `@open-competition-kit/large-files/local` (default)

Writes under a configurable root (`/data/files`), sharding keys into subdirectories
to avoid million-entry directories. `link()` returns `undefined`; the service proxies.

The one thing to be explicit about: **the UI service writes and the runner service
reads, so they must share the volume.** This is not a new burden — the example
compose already does exactly this for the FIT5047 sources:

```yaml
volumes:
  - ./data:/data # must be mounted into *both* ui and runner
```

Get this wrong and the runner reports "file not found" for every job, so it is worth
failing loudly at startup when the root is unwritable or unshared.

### `@open-competition-kit/large-files/s3`

Any S3-compatible store (AWS, R2, MinIO). `link()` presigns, so uploads and
downloads bypass the app entirely. This is the one that makes multi-node and
autoscaled deployments viable, since it removes the shared-volume requirement.

## The upload path

Today a submission's form values are posted as a JSON string through a server
function. Large files must not go that way — RPC bodies are buffered.

```
1. Browser  → server:  "I want to upload source.zip, 240 MB"
2. Server:             authorise (enrolled? within quota? track open?)
                       key = files/<competition>/<user>/<uuid>/source.zip
                       url = files.link({ key, mode: "write" })
3. Server   → browser: { url, key }          ← presigned, or a local proxy endpoint
4. Browser  → storage: PUT the bytes directly
5. Browser  → server:  "done, key=…"
6. Server:             files.peek({ key })   ← verify it exists and the size is sane
                       store the FileRef in the submission body
```

Step 6 matters: the client says "done", and the server must not take its word for it.
`peek()` is the check that the bytes are actually there and within the declared size,
before anything downstream trusts the reference.

A new form field `kind: file` in `form/json` drives this, and the submission's value
for that field is the `FileRef`.

## Migrating what exists

`integration/github-classic` currently writes
`reference.std.submissionSourceCodeZipB64`. It would instead `files.write()` the
archive and store a `FileRef` under a new `reference.std.submissionSource`.

Keep reading the old base64 reference as a fallback for one release, so existing
runners — including the FIT5047 one, which reads the B64 reference directly — keep
working while they migrate. Then drop it, and the 10&nbsp;MB cap with it.

## Why not just use Postgres `bytea` / large objects

It keeps the single-database simplicity, and it is genuinely the least work. But it
preserves every real problem: backups still carry the bytes, the browser still cannot
talk to storage directly, memory use still scales with submission size, and storage
remains welded to the database. It is the current design with a better encoding.

## Rough effort

| Piece                                         | Estimate    |
| --------------------------------------------- | ----------- |
| `FileRef`, `files.*` hooks, `file` table, GC  | ~1 day      |
| `large-files/local` backend                   | ~1 day      |
| Upload endpoint + `kind: file` form field     | ~2 days     |
| Migrate `github-classic` to write a `FileRef` | ~half a day |
| `large-files/s3` backend                      | ~1 day      |

## One dependency worth flagging

If untrusted code is going to run — and you have said sandboxing is a blocker before
anything public — then the runner should receive submission files as a **read-only
mount into the job's container**, not as bytes the runner process handles itself.
The `files` implementation point should therefore be designed knowing that its main
consumer is a container boundary, not a `Buffer`. That is another reason `link()`
and `read()` are stream/URL-shaped rather than `Uint8Array`-shaped.
