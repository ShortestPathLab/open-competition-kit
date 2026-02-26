export type Result<Out, Error> =
  | {
      error: undefined;
      value: Out;
    }
  | {
      value: undefined;
      error: Error;
    };

export const unsafe = async <T, U>(t: Promise<Result<T, U>>) => {
  const r = await t;
  if (r.error) {
    throw r.error;
  }
  return r.value as T;
};
