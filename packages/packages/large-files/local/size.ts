/**
 * How big a body is before it is written.
 *
 * Its own module because the answer is easy to get quietly wrong: a string's
 * `length` counts characters, and a submission full of accented text or CJK is
 * bigger on disk than it looks. An under-count here is a file admitted past a
 * ceiling that was meant to stop it, and nothing downstream would notice.
 */
import type { FileBody } from "@open-competition-kit/sdk";

/** Undefined for a stream, whose size is not knowable until it has been read. */
export const sizeOf = (body: FileBody): number | undefined =>
  typeof body === "string"
    ? Buffer.byteLength(body)
    : body instanceof Blob
      ? body.size
      : body instanceof Uint8Array || body instanceof ArrayBuffer
        ? body.byteLength
        : undefined;

export const tooLarge = (size: number, limit: number) =>
  new Error(`File is ${size} bytes, and this storage backend accepts at most ${limit}.`);
