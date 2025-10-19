import { Schema as S } from "effect";

export const hook = <T extends S.Struct.Field, U extends S.Struct.Field>(
  _a: T,
  _b: U
) =>
  S.declare(
    (input): input is (a: S.Schema.Type<T>) => Promise<S.Schema.Type<U>> =>
      typeof input === "function"
  );
