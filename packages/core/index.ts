import { Data } from "effect";

export type { OpenCompetitionKitApi } from "./api";
export { OpenCompetitionKitDatabase } from "./db";
export { OpenCompetitionKitHooks } from "./hook";
export {
  OpenCompetitionKitConfig,
  Config,
  CompetitionConfig,
  TrackConfig,
} from "./config";
export type { Package, Hooks } from "./hook";
export { OpenCompetitionKit } from "./open-competition-kit";
export type {
  Competition,
  CompetitionCreate,
  CompetitionUpdate,
  Enrolment,
  EnrolmentCreate,
  EnrolmentUpdate,
  Job,
  JobCreate,
  JobUpdate,
  Output,
  OutputCreate,
  OutputUpdate,
  Submission,
  SubmissionCreate,
  SubmissionUpdate,
  Track,
  TrackCreate,
  TrackUpdate,
  User,
  UserCreate,
  UserUpdate,
} from "./hook/db";

export * as hook from "./hook";

export class NoopError extends Data.TaggedError("NoopError") {}
