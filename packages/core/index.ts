import { Data } from "effect";

export type { OpenCompetitionKitApi } from "./api";
export { OpenCompetitionKitDatabase } from "./db";
export { OpenCompetitionKitHooks } from "./hook";
export {
  OpenCompetitionKitConfig,
  Config,
  CompetitionConfig,
  type Accessor as ConfigAccessor,
  TrackConfig,
  type Form,
  type Leaderboard,
  type LeaderboardSource,
  describeWindowState,
  formatInstant,
  isOpenAt,
  windowStateAt,
  type SubmissionWindow,
  type WindowState,
  isDraft,
  isVisibleTo,
  type Visibility,
} from "./config";
export type { Package, Hooks } from "./hook";
export { OpenCompetitionKit } from "./open-competition-kit";
export type {
  Competition,
  CompetitionCreate,
  CompetitionUpdate,
  Context,
  ContextCreate,
  ContextUpdate,
  Enrolment,
  EnrolmentCreate,
  EnrolmentUpdate,
  Job,
  JobCreate,
  JobUpdate,
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

export {
  FileRef,
  isFile,
  keyOf,
  makeKey,
  toFileRef,
  type FileBody,
  type FileMeta,
} from "./file";

export {
  describeRefusals,
  verdictOf,
  type GateRequest,
  type GateVerdict,
  type Refusal,
} from "./gate";

export * as hook from "./hook";

export * as reference from "./tag";
export * as namespace from "./namespace";

export class NoopError extends Data.TaggedError("NoopError") {}
