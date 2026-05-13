import type { OutKeyword } from "typescript";

export type Result<Out, Error> =
  | { error: undefined; value: Out }
  | { value: undefined; error: Error };

export const unsafe = async <T, U>(t: Promise<Result<T, U>>) => {
  const r = await t;
  if (r.error) {
    throw r.error;
  }
  return r.value as T;
};

type PreserveNullable<T, U> = U | Extract<T, null | undefined>;

/**
 * Casts the value type of a Result or Result-containing Promise to a
 * specified type.
 * Preserves undefined and null values.
 */
export function cast<TCast>() {
  function f<Out, Error>(
    t: Promise<Result<Out, Error>>,
  ): Promise<Result<PreserveNullable<Out, TCast>, Error>>;
  function f<Out, Error>(
    t: Result<Out, Error>,
  ): Result<PreserveNullable<Out, TCast>, Error>;
  function f(t: any) {
    return t;
  }
  return f;
}
