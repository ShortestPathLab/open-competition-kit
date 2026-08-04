import { kit } from "./kit";

export const {
  competitions,
  config,
  hooks,
  enrolments,
  tracks,
  users,
  context,
  files,
  forms,
  jobs,
  leaderboards,
  outputs,
  machine,
  secrets,
  submissions,
} = kit;

export * from "@open-competition-kit/core";

export default kit;

export * as system from "./system";

/**
 * Reading a submission: `source.archive` for the bytes, `source.files` for the
 * permitted files already unpacked.
 */
export * as source from "./source";

export * from "./result";

export * from "./instant";

export * from "./kit";

export * from "./ui";

export { surfaces, views } from "./surface";
export type {
  SurfaceContributor,
  SurfaceContributors,
  SurfaceRequestFor,
  SurfaceViews,
} from "./surface";
