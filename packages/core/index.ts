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
  Timestamp,
  type Form,
  type Leaderboard,
  isDraft,
  isVisibleTo,
  propagateExtendable,
  type Visibility,
  ConfigExtensionError,
  CORE_KEYS,
  CORE_FIELDS,
  describeConfig,
  hasCoreFields,
  setConfig,
  walkNodes,
  type ConfigEdit,
  type ConfigFieldDescription,
  type ConfigNodeDescription,
  type ConfigSectionDescription,
  type ConfigWriteIssue,
  type ConfigWriteResult,
  type ConfigWritability,
  type ConfigWritabilityReason,
  type ConfigWriteStrategy,
  isStandardSchema,
  validateConfig,
  validateNode,
  type ConfigExtension,
  type ConfigExtensions,
  type NodeKind,
  type ResolvedExtension,
  type StandardSchemaV1,
} from "./config";
export * from "./package/uri";
export * from "./package/cache";
export * from "./package/loader";
export * from "./package/registry";
export * from "./package/install";
export type { Package, Hooks, LeaderboardUiDef, LeaderboardViewProps } from "./hook";
export { restart, restartSupport, type RestartSupport } from "./lifecycle";
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

export { FileRef, isFile, keyOf, makeKey, toFileRef, type FileBody, type FileMeta } from "./file";

export {
  describeRefusals,
  nextInstant,
  verdictOf,
  worstOf,
  type GateReport,
  type GateRequest,
  type GateStatusRequest,
  type GateVerdict,
  type Refusal,
} from "./gate";

export {
  audienceOf,
  orderItems,
  organiserOnly,
  region,
  type Audience,
  type Subject,
  type SurfaceAction,
  type SurfaceContentHook,
  type SurfaceContext,
  type SurfaceId,
  type SurfaceItem,
  type SurfaceNote,
  type SurfaceRequest,
  type Surfaces,
  type SurfaceViewHook,
  type SurfaceViewProps,
} from "./surface";

export * as surface from "./surface";

export * as hook from "./hook";

export * as reference from "./tag";
export * as namespace from "./namespace";

export class NoopError extends Data.TaggedError("NoopError") {}
