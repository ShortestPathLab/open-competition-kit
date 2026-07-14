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
  secrets,
  submissions,
} = kit;

export * from "@open-competition-kit/core";

export default kit;

export * as system from "./system";

export * from "./result";

export * from "./kit";

export * from "./ui";
