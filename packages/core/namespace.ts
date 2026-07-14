export const stem = "open-competition-kit/namespace" as const;

export const namespaces = [
  `${stem}/job`,
  `${stem}/job/output`,
  `${stem}/user`,
  `${stem}/user/secret`,
  // A file's owner. A submission's attachment outlives the jobs that read it, so
  // files need an owner that is not a job.
  `${stem}/submission`,
] as const;

export type Namespace = (typeof namespaces)[number];
