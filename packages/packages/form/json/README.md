# `@open-competition-kit/form-json`

Renders a track's submission form from its `shape:` config, using React JSON
Schema Form with shadcn components.

Implements `form.ui`.

## Field kinds

```yaml
form:
  shape:
    - id: notes
      name: Notes
      kind: textarea
      lines: 5
    - id: agent
      name: Agent archive
      kind: file          # ← uploads, and stores a FileRef
      required: true
```

| `kind` | Value |
|---|---|
| `text` (default), `email`, `textarea` | string |
| `number` | number |
| `checkbox` | boolean |
| `select` (with `options:`) | string |
| `file` | a `FileRef` object |

## `kind: file`

The bytes never travel through the form's submit. The file is uploaded as soon as
it is picked, and the form value is a **`FileRef`** — the small JSON pointer that
goes in the database in place of the bytes.

The upload runs in three steps:

1. **claim a key** — `POST /api/files/request-upload`. The server derives the key;
   the client never chooses it.
2. **send the bytes** — straight to the bucket via a presigned `PUT` if the
   large-file backend can presign one, otherwise proxied through
   `PUT /api/files/upload`. This is why an S3 deployment can accept a
   multi-gigabyte submission without it touching the app server.
3. **seal it** — `POST /api/files/complete-upload`. The server asks storage what
   actually arrived, rather than believing the client.

Progress is reported during (2), which needs `XMLHttpRequest` — `fetch` cannot
report upload progress, and a participant pushing a large archive over a slow
connection needs to see that it is moving.

This requires a package implementing the `files` hooks — see
`@open-competition-kit/large-files-local` or `-s3`.

A runner reads the file with `files.read(ref)`.
