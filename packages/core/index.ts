import { Data } from "effect";

export type { OpenCompetitionKitApi } from "./api";
export { OpenCompetitionKitConfig } from "./config";
export { OpenCompetitionKitDatabase } from "./db";
export { OpenCompetitionKitHooks } from "./hook";
export type { Package } from "./hook";
export { OpenCompetitionKit } from "./open-competition-kit";

export * as hook from "./hook";

export class NoopError extends Data.TaggedError("NoopError") {}
