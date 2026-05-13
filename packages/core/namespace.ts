export const stem = "open-competition-kit/namespace" as const;

export const namespaces = [
  `${stem}/job`,
  `${stem}/user`,
  `${stem}/user/secret`,
] as const;

export type Namespace = (typeof namespaces)[number];
