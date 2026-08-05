import { assert, flattenDeep, head } from "es-toolkit";
import { find, has, isArray, isObject, isString, keys } from "es-toolkit/compat";
import { Config } from "../config";
import { Effect as E, Data as D } from "effect";

declare const __value: unique symbol;

export type Accessor<T = Config> =
  T extends ReadonlyArray<infer R>
    ? R extends { id: string; with: readonly string[] }
      ? (string & { [__value]?: R }) | { [K in keyof R]?: Accessor<R[K]> }
      : never
    : T extends Record<string, unknown>
      ? T extends { with: readonly string[] }
        ?
            | {
                [K in keyof T as T[K] extends undefined ? never : K]?: Accessor<T[K]>;
              }
            | (true & { [__value]?: T })
        : { [K in keyof T as T[K] extends undefined ? never : K]?: Accessor<T[K]> }
      : never;

export type AccessorValue<T, TBase = Accessor> = T extends string | true
  ? TBase extends { [__value]?: infer R }
    ? R
    : never
  : T extends Record<string, unknown>
    ? TBase extends Record<string, unknown>
      ? {
          [K in keyof T]: K extends keyof TBase ? AccessorValue<T[K], TBase[K]> : never;
        }[keyof T]
      : never
    : never;

export class ConfigAccessorError extends D.TaggedError("ConfigAccessorError")<{
  cause: unknown;
}> {}

export const accessRecursive = <T extends Accessor>(
  accessor: T,
  obj: unknown,
): AccessorValue<T> => {
  if (accessor === true) {
    assert(has(obj, "with"), "Accessed object is invalid.");
    return obj as AccessorValue<T>;
  }
  if (isString(accessor)) {
    assert(
      isArray(obj),
      `Attempted to access non-array object with key: ${accessor}, on ${JSON.stringify(obj, null, 2)}`,
    );
    return find(obj, { id: accessor }) as AccessorValue<T>;
  }
  if (isObject(accessor)) {
    const key = head(keys(accessor)) as (string & keyof typeof accessor) | undefined;
    assert(key, "Accessor is empty.");
    if (isArray(obj)) {
      return accessRecursive(
        accessor[key] as Accessor<T>,
        flattenDeep(
          obj.map((c) => {
            assert(
              has(c, key),
              `Attempted to access non-existent property (array): ${key}, on ${JSON.stringify(c, null, 2)}`,
            );
            return c[key];
          }),
        ),
      ) as AccessorValue<T>;
    }
    if (isObject(obj)) {
      assert(
        has(obj, key),
        `Attempted to access non-existent property: ${key}, on ${JSON.stringify(obj, null, 2)}`,
      );
      return accessRecursive(accessor[key] as Accessor<T>, obj[key]) as AccessorValue<T>;
    }
  }
  throw new Error("Malformed accessor.");
};

export const access = <T extends Accessor>(accessor: T, obj: unknown) =>
  E.try({
    try: () => accessRecursive(accessor, obj),
    catch: (e) => new ConfigAccessorError({ cause: e }),
  });
