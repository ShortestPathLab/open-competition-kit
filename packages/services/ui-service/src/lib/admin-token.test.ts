import { beforeEach, describe, expect, test } from "bun:test";
import { resetThrottle, throttle, tokenMatches } from "./admin-token.server";

describe("comparing a presented token", () => {
  test("accepts the real one", () => {
    expect(tokenMatches("s3cret-token", "s3cret-token")).toBe(true);
  });

  test("rejects a wrong one", () => {
    expect(tokenMatches("s3cret-tokem", "s3cret-token")).toBe(false);
  });

  // `timingSafeEqual` throws when the two buffers differ in length, so a naive
  // implementation has to catch that, and the catch puts the length of the real
  // token back into the timing. Hashing first makes both sides 32 bytes.
  test("rejects a shorter and a longer one without throwing", () => {
    expect(tokenMatches("s3cret", "s3cret-token")).toBe(false);
    expect(tokenMatches("s3cret-token-and-more", "s3cret-token")).toBe(false);
  });

  test("rejects an empty presentation", () => {
    expect(tokenMatches("", "s3cret-token")).toBe(false);
  });

  test("is not fooled by a prefix", () => {
    expect(tokenMatches("s", "s3cret-token")).toBe(false);
  });
});

describe("limiting guesses", () => {
  beforeEach(resetThrottle);

  test("allows five attempts and then stops", () => {
    for (let i = 0; i < 5; i++) {
      expect(throttle("user-1").allowed).toBe(true);
    }
    expect(throttle("user-1").allowed).toBe(false);
  });

  test("counts each account separately", () => {
    for (let i = 0; i < 5; i++) throttle("user-1");
    expect(throttle("user-1").allowed).toBe(false);
    expect(throttle("user-2").allowed).toBe(true);
  });

  test("reports how many are left", () => {
    expect(throttle("user-1").remaining).toBe(4);
    expect(throttle("user-1").remaining).toBe(3);
  });

  test("the window reopens once it has passed", () => {
    const start = 1_000_000;
    for (let i = 0; i < 5; i++) throttle("user-1", start);
    expect(throttle("user-1", start).allowed).toBe(false);

    // Fifteen minutes and a bit.
    expect(throttle("user-1", start + 15 * 60 * 1000 + 1).allowed).toBe(true);
  });

  test("the count does not reopen early", () => {
    const start = 1_000_000;
    for (let i = 0; i < 5; i++) throttle("user-1", start);
    expect(throttle("user-1", start + 14 * 60 * 1000).allowed).toBe(false);
  });
});
