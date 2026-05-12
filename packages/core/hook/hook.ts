import { Schema as S } from "effect";

export const hook = <T, U>() =>
  S.declare(
    (input): input is (a: T, next?: (a: T) => Promise<U>) => Promise<U> =>
      typeof input === "function",
  );
