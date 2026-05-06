import { Effect as E, Schema as S } from "effect";
import { mapValues } from "lodash-es";
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
    competition: S.String,
  }),
  job: createSchemas("open-competition-kit/db/job", {
    submission: S.String,
    status: S.String,
  }),
  output: createSchemas("open-competition-kit/db/output", {
    job: S.String,
    value: S.String,
    reference: S.String,
  }),
  context: createSchemas("open-competition-kit/db/context", {
    job: S.String,
    value: S.String,
    reference: S.String,
  }),
  competition: createSchemas("open-competition-kit/db/competition", {
    name: S.String,
    organiser: S.String,
    description: S.String,
    overview: S.String,
    rules: S.String,
    index: S.Int,
  }),
  submission: createSchemas("open-competition-kit/db/submission", {
    user: S.String,
    track: S.String,
    body: S.String,
  }),
  track: createSchemas("open-competition-kit/db/track", {
    name: S.String,
    competition: S.String,
    description: S.String,
    overview: S.String,
    rules: S.String,
    index: S.Int,
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
export type Context = DbRecord<"context">;
export type ContextCreate = DbCreate<"context">;
export type ContextUpdate = DbUpdate<"context">;
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

const tableHooks = <F>() =>
  S.Struct({
    /**
     * Get a list of items in this collection.
     */
    list: hook<Partial<F>, F[]>(),
    get: hook<string, F>(),
    create: hook<Partial<F>, F>(),
    update: hook<Partial<F>, void>(),
    delete: hook<string, void>(),
  });

export const collections = S.Struct({
  competitions: tableHooks<typeof schemas.competition>(),
  users: tableHooks<typeof schemas.user>(),
  tracks: tableHooks<typeof schemas.track>(),
  enrolments: tableHooks<typeof schemas.enrolment>(),
  submissions: tableHooks<typeof schemas.submission>(),
  jobs: tableHooks<typeof schemas.job>(),
  context: tableHooks<typeof schemas.context>(),
  outputs: tableHooks<typeof schemas.output>(),
});

type Acc<T> = {
  collection: keyof typeof schemas;
  payload: T;
};

export const db = S.Struct({
  list: hook<Acc<any>, unknown>(),
  get: hook<Acc<string>, unknown>(),
  create: hook<Acc<any>, unknown>(),
  update: hook<Acc<any>, void>(),
  delete: hook<Acc<string>, void>(),
});
