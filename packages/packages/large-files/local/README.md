# `@open-competition-kit/large-files-local`

Stores large files on the local filesystem. The default backend, and the right
one for a single-host deployment.

Implements the `files` implementation point: `write`, `read`, `peek`, `delete`,
`link`, and `limit`.

## Using it

```yaml
with:
  - "@open-competition-kit/large-files-local"

files:
  root: /data/files # default: /data/files, or $LARGE_FILES_ROOT
  maxBytes: 536870912 # optional. Omit and the disk is the ceiling.
```

The block was called `largeFiles:` up to 0.0.10. The old name still works and
warns at startup.

`maxBytes` is this package's, not core's. A file past it is refused, and one that
reached the disk before its size was known is deleted rather than left there.

## The one thing to get right

**Every service that reads or writes submissions must mount the same volume at
the same path.** The UI service writes the file; the runner service reads it. If
the volume is not shared, every job fails with "no such file" and the cause is
nowhere near the symptom.

```yaml
services:
  ui:
    image: ghcr.io/…/ui-service
    volumes:
      - ./data:/data # ← same volume…
  runner-service:
    image: ghcr.io/…/runner-service
    volumes:
      - ./data:/data # ← …mounted at the same path
```

This package checks the root is writable at startup and throws if it is not,
rather than letting each job discover the problem separately.

If you cannot share a volume — multiple hosts, autoscaling, serverless — use
`@open-competition-kit/large-files-s3` instead. That is the constraint it exists
to remove.

## Notes

`link()` returns `undefined`: the local filesystem has no URL a browser can
reach, so the caller streams the bytes through the app server. Checksums are
sha256, computed by streaming, so hashing a multi-gigabyte submission does not
require holding it in memory.

Keys are derived by core, never taken from a client, but this package still
refuses to resolve a key outside its root — a storage backend is the wrong place
to assume its caller got that right.
