export type Value = string | number | boolean | null;

/**
 * Basic representation of a data point.
 */
export type Point = {
  key: string;
  value?: Value;
  label?: string;
};

/**
 * Basic representation of a description of a data point.
 */
export type Shape<TKind extends string = string> = {
  key: string;
  label?: string;
  kind?: TKind;
};

export type Meta = {
  label?: string;
  description?: string;
};
