# `@open-competition-kit/large-files-s3`

Stores large files in any S3-compatible bucket — AWS S3, Cloudflare R2, MinIO,
Backblaze — using Bun's native S3 client, so there is no AWS SDK dependency.

Implements the `files` implementation point: `write`, `read`, `peek`, `delete`,
`link`, and `limit`.

## Why you would use this over the local backend

**`link()` presigns.** The browser talks to the bucket directly, so a
multi-gigabyte submission never passes through the app server, and the UI and
runner services no longer need to share a volume. That is what makes multi-host
and autoscaled deployments possible.

## Using it

```yaml
with:
  - "@open-competition-kit/large-files-s3"

files:
  bucket: my-competition-bucket
  region: us-east-1
  endpoint: https://…  # omit for AWS; required for R2 / MinIO
  expiresIn: 900       # presigned URL lifetime in seconds (default: 900)
  maxBytes: 536870912  # optional. Omit and the bill is the ceiling.
```

The block was called `largeFiles:` up to 0.0.10. The old name still works and
warns at startup.

Credentials fall back to the environment, so they need not be written into the
config file:

| Config | Environment |
|---|---|
| `files.bucket` | `S3_BUCKET` |
| `files.accessKeyId` | `S3_ACCESS_KEY_ID` |
| `files.secretAccessKey` | `S3_SECRET_ACCESS_KEY` |
| `files.sessionToken` | `S3_SESSION_TOKEN` |
| `files.region` | `S3_REGION` |
| `files.endpoint` | `S3_ENDPOINT` |

Some non-AWS implementations need `virtualHostedStyle: true`.

## Notes on `peek()`

`checksum` is the object's **ETag**, not a sha256. For a single-part upload the
ETag happens to be an MD5 of the content, but for a multipart upload it is not a
content hash at all — so do not treat it as one.

`write()` deliberately does not compute a sha256 either: doing so would mean
streaming the whole object back out of the bucket, which defeats the point of
having put it there. If you need a content hash, have the producer supply one.

## Notes on `maxBytes`

The size is only known once the object is in the bucket, since `write` reports
what it stored rather than being asked in advance. An oversized one is deleted
before the error is raised, because a refusal that leaves the object behind still
bills the organiser every month.

A presigned upload never passes through this package at all, so that path is
checked when the upload is sealed rather than while it happens.
