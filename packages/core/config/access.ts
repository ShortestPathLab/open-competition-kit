import { assert, head } from "es-toolkit";
import {
  find,
  has,
  isArray,
  isObject,
  isString,
  keys,
} from "es-toolkit/compat";
import { Config } from "../config";

declare const __value: unique symbol;

export type Accessor<T = Config> =
  T extends ReadonlyArray<infer R> ?
    R extends { id: string; with: readonly string[] } ?
      (string & { [__value]?: R }) | { [K in keyof R]?: Accessor<R[K]> }
    : never
  : T extends Record<string, unknown> ?
    T extends { with: readonly string[] } ?
      | {
          [K in keyof T as T[K] extends undefined ? never : K]?: Accessor<T[K]>;
        }
      | (true & { [__value]?: T })
    : { [K in keyof T as T[K] extends undefined ? never : K]?: Accessor<T[K]> }
  : never;

export type AccessorValue<T, TBase = Accessor> =
  T extends string | true ?
    TBase extends { [__value]?: infer R } ?
      R
    : never
  : T extends Record<string, unknown> ?
    TBase extends Record<string, unknown> ?
      {
        [K in keyof T]: K extends keyof TBase ? AccessorValue<T[K], TBase[K]>
        : never;
      }[keyof T]
    : never
  : never;

export const access = <T extends Accessor>(
  accessor: T,
  obj: unknown,
): AccessorValue<T> => {
  if (accessor === true) {
    assert(has(obj, "with"), "Accessed object is invalid.");
    return obj as AccessorValue<T>;
  }
  if (isString(accessor)) {
    assert(isArray(obj), "Attempted to access non-array object with key.");
    return find(obj, { id: accessor }) as AccessorValue<T>;
  }
  if (isObject(accessor)) {
    const key = head(keys(accessor)) as keyof typeof accessor | undefined;
    assert(key, "Accessor is empty.");
    if (isObject(obj)) {
      assert(has(obj, key), "Attempted to access non-existent property.");
      return access(accessor[key] as Accessor<T>, obj[key]) as AccessorValue<T>;
    }
    if (isArray(obj)) {
      return access(
        accessor[key] as Accessor<T>,
        obj.map((c) => {
          assert(
            has(key, "c"),
            "Attempted to access non-existent property (array).",
          );
          return c[key];
        }),
      ) as AccessorValue<T>;
    }
  }
  throw new Error("Malformed accessor.");
};
