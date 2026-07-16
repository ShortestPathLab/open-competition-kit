import { describe, expect, test } from "bun:test";
import { unsafe, type Result } from "./result";

describe("unsafe", () => {
  test("unwraps the value of a successful result", async () => {
    const ok: Result<number, never> = { error: undefined, value: 41 };
    expect(await unsafe(Promise.resolve(ok))).toBe(41);
  });

  test("throws the error of a failed result, verbatim", async () => {
    const boom = new Error("nope");
    const fail: Result<never, Error> = { value: undefined, error: boom };

    await expect(unsafe(Promise.resolve(fail))).rejects.toBe(boom);
  });

  test("returns a null value that a successful result legitimately carries", async () => {
    const ok: Result<null, never> = { error: undefined, value: null };
    expect(await unsafe(Promise.resolve(ok))).toBeNull();
  });
});
