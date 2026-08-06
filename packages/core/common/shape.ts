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

/** One choice a field accepts, for a field that accepts a fixed few. */
export type FieldOption = { value: string; label: string };

/**
 * A field as a settings editor needs to draw it, which is more than validation
 * has vocabulary for.
 *
 * `options` turns a text box into a picker, for a field whose schema accepts a
 * short fixed list. `secret` says the value is a credential: an editor shows
 * whether one is set and takes a new one, and never prints the one it has. A
 * connection string and an access key are readable by anyone looking over an
 * organiser's shoulder otherwise, and a settings page is exactly where somebody
 * screen-shares.
 */
export type FieldPresentation = Shape &
  Meta & {
    options?: readonly FieldOption[];
    secret?: boolean;
  };
