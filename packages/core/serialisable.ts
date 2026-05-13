export type SerialisablePrimitive = string | number | boolean | null;

export type SerialisableValue =
  | SerialisablePrimitive
  | { [key: string]: SerialisableValue }
  | SerialisableValue[];

// If you specifically want "objects only" (excluding primitives):
export type SerialisableObject = { [key: string]: SerialisableValue };
