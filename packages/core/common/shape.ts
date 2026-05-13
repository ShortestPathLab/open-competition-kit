import { Schema as S } from "effect";

export const Value = S.Union(S.String, S.Number, S.Boolean, S.Null);
export type Value = S.Schema.Type<typeof Value>;

export const Item = S.Struct({ id: S.String, name: S.optional(S.String) });
/**
 * Basic representation of a data point.
 */
export const Point = S.Struct({
  id: S.String,
  value: S.optional(Value),
  name: S.optional(S.String),
});
export type Point = S.Schema.Type<typeof Point>;

/**
 * Basic representation of a description of a data point.
 */
export const Shape = S.Struct({
  id: S.String,
  name: S.optional(S.String),
  kind: S.optional(S.String),
});
export type Shape = S.Schema.Type<typeof Shape>;

export const Meta = S.Struct({
  label: S.optional(S.String),
  description: S.optional(S.String),
});
export type Meta = S.Schema.Type<typeof Meta>;
