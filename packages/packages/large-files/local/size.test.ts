import { describe, expect, test } from "bun:test";
import { sizeOf, tooLarge } from "./size";

describe("sizeOf", () => {
  test("counts a string in bytes, not characters", () => {
    // Four characters, twelve bytes. Counting characters would let a file three
    // times the ceiling through.
    expect(sizeOf("日本語で")).toBe(12);
    expect("日本語で".length).toBe(4);
  });

  test("reads the length off the buffer kinds", () => {
    expect(sizeOf(new Uint8Array(64))).toBe(64);
    expect(sizeOf(new ArrayBuffer(64))).toBe(64);
    expect(sizeOf(new Blob(["hello"]))).toBe(5);
  });

  test("has no answer for a stream", () => {
    const stream = new Blob(["hello"]).stream() as ReadableStream<Uint8Array>;
    expect(sizeOf(stream)).toBeUndefined();
  });

  test("an empty body is zero rather than unknown", () => {
    // Zero and undefined take different branches upstream: one is a file that
    // passes any ceiling, the other is a file that has to be written to be
    // measured.
    expect(sizeOf("")).toBe(0);
    expect(sizeOf(new Uint8Array(0))).toBe(0);
  });
});

describe("tooLarge", () => {
  test("names both figures, since neither alone is actionable", () => {
    expect(tooLarge(2048, 1024).message).toBe(
      "File is 2048 bytes, and this storage backend accepts at most 1024.",
    );
  });
});
