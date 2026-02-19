import { Schema as S, Effect as E, Schema } from "effect";
import { hook } from "./hook";
import { keys, mapValues } from "lodash-es";
import { OpenCompetitionKitHooks } from ".";

export const { Number, Boolean, Date, String, Int } = S;

export const Id = S.String.annotations({
  identifier: "open-competition-kit/db/Id",
});

// export const isLiteral = (s) =>

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
  create: S.Struct(fields),
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
  competition: createSchemas("open-competition-kit/db/competition", {
    name: S.String,
  }),
  track: createSchemas("open-competition-kit/db/track", {
    name: S.String,
    competition: S.String,
  }),
  user: createSchemas("open-competition-kit/db/user", {
    name: S.String,
  }),
};

export const schemas = mapValues(tables, (v) => v.full) as {
  [K in keyof typeof tables]: (typeof tables)[K]["full"];
};

export type DbKey = keyof typeof schemas;

export type TableHooks<T> = {
  list: (partial: Partial<T>) => Promise<Readonly<T[]>>;
  get: (id: string) => Promise<T>;
  create: (data: Omit<T, "id">) => Promise<T>;
  update: (data: Partial<T> & { id: string }) => Promise<void>;
  delete: (id: string) => Promise<void>;
};

export type WithHooks<T, E, C> = {
  [K in keyof TableHooks<T>]: TableHooks<T>[K] extends (
    ...args: infer In
  ) => Promise<infer Out>
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

export const withHooks = <T>(h: TableHooks<T>) =>
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
