import { Schema as S } from "effect";
import type { FileBody, FileMeta } from "../file";
import { hook } from "./hook";

/**
 * Large file storage. Like `db`, an infrastructure implementation point: it moves
 * bytes, so it deals in streams and cannot cross a language boundary.
 */
export const files = S.Struct({
  /** Store bytes. Returns what the caller should persist in the database. */
  write: hook<{ key: string; body: FileBody; contentType?: string }, FileMeta>(),
  /** Stream the bytes back out. */
  read: hook<{ key: string }, ReadableStream<Uint8Array>>(),
  /** Size, existence, checksum, without fetching the body. */
  peek: hook<{ key: string }, FileMeta | undefined>(),
  delete: hook<{ key: string }, void>(),
  /**
   * The largest file this backend will take, in bytes, or undefined for no
   * ceiling. A filesystem with a quota and a bucket with a billing limit do not
   * have the same answer, and neither is core's to know. Core asks when sealing an
   * upload; a UI asks so it can turn a file away in the browser.
   */
  limit: hook<void, number | undefined>(),
  /**
   * A URL the browser can use directly, so a large transfer never passes through
   * the app server. Backends that cannot presign return undefined and the caller
   * proxies instead, keeping every backend usable and letting good ones be fast.
   */
  link: hook<{ key: string; mode: "read" | "write"; expiresIn?: number }, string | undefined>(),
});
