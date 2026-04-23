import { Effect as E, Schema as S } from "effect";
import { keys, mapValues } from "lodash-es";
import { OpenCompetitionKitHooks } from ".";
import { hook } from "./hook";

export const { Number, Boolean, Date, String, Int } = S;

export const Id = S.String.annotations({
  identifier: "open-competition-kit/db/Id",
});

const createSchemas = <
  K extends string,
  T extends {
    [x: Readonly<PropertyKey>]: S.Schema<any>;
  },
>(
  key: K,
  fields: T,
) => ({
  full: S.TaggedStruct(key, {
    id: Id,
    ...fields,
  }),
  create: S.Struct({
    id: S.optional(Id),
    ...fields,
  }),
  update: S.Struct({
    id: Id,
    ...mapValues(fields, (f) => S.Union(f, S.Void, S.Undefined)),
  }),
});

export const tables = {
  enrolment: createSchemas("open-competition-kit/db/enrolment", {
    user: S.String,
    track: S.String,
  }),
  job: createSchemas("open-competition-kit/db/job", {
    submission: S.String,
    status: S.String,
  }),
  output: createSchemas("open-competition-kit/db/output", {
    job: S.String,
    result: S.String,
    reference: S.String,
  }),
  competition: createSchemas("open-competition-kit/db/competition", {
    name: S.String,
  }),
  submission: createSchemas("open-competition-kit/db/submission", {
    user: S.String,
    track: S.String,
    body: S.String,
  }),
  track: createSchemas("open-competition-kit/db/track", {
    name: S.String,
    competition: S.String,
  }),
  user: createSchemas("open-competition-kit/db/user", {
    name: S.String,
    secrets: S.String,
  }),
};

export const schemas = mapValues(tables, (v) => v.full) as {
  [K in keyof typeof tables]: (typeof tables)[K]["full"];
};

export type DbKey = keyof typeof schemas;
export type DbRecord<K extends DbKey> = S.Schema.Type<(typeof schemas)[K]>;
export type DbCreate<K extends DbKey> = S.Schema.Type<
  (typeof tables)[K]["create"]
>;
export type DbUpdate<K extends DbKey> = S.Schema.Type<
  (typeof tables)[K]["update"]
>;

export type Competition = DbRecord<"competition">;
export type CompetitionCreate = DbCreate<"competition">;
export type CompetitionUpdate = DbUpdate<"competition">;
export type Enrolment = DbRecord<"enrolment">;
export type EnrolmentCreate = DbCreate<"enrolment">;
export type EnrolmentUpdate = DbUpdate<"enrolment">;
export type Job = DbRecord<"job">;
export type JobCreate = DbCreate<"job">;
export type JobUpdate = DbUpdate<"job">;
export type Output = DbRecord<"output">;
export type OutputCreate = DbCreate<"output">;
export type OutputUpdate = DbUpdate<"output">;
export type Submission = DbRecord<"submission">;
export type SubmissionCreate = DbCreate<"submission">;
export type SubmissionUpdate = DbUpdate<"submission">;
export type Track = DbRecord<"track">;
export type TrackCreate = DbCreate<"track">;
export type TrackUpdate = DbUpdate<"track">;
export type User = DbRecord<"user">;
export type UserCreate = DbCreate<"user">;
export type UserUpdate = DbUpdate<"user">;

export type TableHooks<TCreate, TUpdate, TFull> = {
  list: (partial: Partial<TFull>) => Promise<Readonly<TFull[]>>;
  get: (id: string) => Promise<TFull>;
  create: (data: TCreate) => Promise<TFull>;
  update: (data: TUpdate) => Promise<void>;
  delete: (id: string) => Promise<void>;
};

export type WithHooks<TCreate, TUpdate, TFull, E, C> = {
  [K in keyof TableHooks<TCreate, TUpdate, TFull>]: TableHooks<
    TCreate,
    TUpdate,
    TFull
  >[K] extends (...args: infer In) => Promise<infer Out>
    ? (...args: In) => E.Effect<Out, E, C>
    : never;
};

const tableHooks = <F extends S.Struct.Fields>(b: S.Struct<F>) =>
  S.Struct({
    /**
     * Get a list of items in this collection.
     */
    list: hook(S.partial(b), S.Array(b)),
    get: hook(S.String, b),
    create: hook(S.partial(b), b),
    update: hook(S.partial(b), S.Void),
    delete: hook(S.String, S.Void),
  });

export const collections = S.Struct({
  competitions: tableHooks(schemas.competition),
  users: tableHooks(schemas.user),
  tracks: tableHooks(schemas.track),
  enrolments: tableHooks(schemas.enrolment),
  submissions: tableHooks(schemas.submission),
  jobs: tableHooks(schemas.job),
  outputs: tableHooks(schemas.output),
});

const accessor = <T extends S.Struct.Field>(payload: T) =>
  S.Struct({
    collection: S.Literal(...(keys(schemas) as (keyof typeof schemas)[])),
    payload,
  });

export const db = S.Struct({
  list: hook(accessor(S.Any), S.Array(S.Unknown)),
  get: hook(accessor(S.String), S.Unknown),
  create: hook(accessor(S.Any), S.Unknown),
  update: hook(accessor(S.Any), S.Void),
  delete: hook(accessor(S.String), S.Void),
});

export const withHooks = <TCreate, TUpdate, TFull>(
  h: TableHooks<TCreate, TUpdate, TFull>,
) =>
  E.gen(function* () {
    const hooks = yield* OpenCompetitionKitHooks;
    return {
      list: hooks.try(h.list),
      get: hooks.try(h.get),
      create: hooks.try(h.create),
      update: hooks.try(h.update),
      delete: hooks.try(h.delete),
    };
  });
