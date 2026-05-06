import { Schema as S } from "effect";

export const hook = <T, U>() =>
  S.declare(
    (input): input is (a: T, next?: (a: U) => Promise<U>) => Promise<U> =>
      typeof input === "function",
  );
