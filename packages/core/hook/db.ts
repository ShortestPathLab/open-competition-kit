import { Schema as S, Effect as E, Schema } from "effect";
import { hook } from "./hook";
import { mapValues } from "lodash-es";
import { OpenCompetitionKitHooks } from ".";

export const { Number, Boolean, Date, String, Int } = S;

export const Id = S.String.annotations({
  identifier: "open-competition-kit/db/Id",
});

export const schemas = {
  competition: S.Struct({
    id: Id,
    name: S.String,
  }),
  track: S.Struct({
    id: Id,
    name: S.String,
    competition: S.String,
  }),
  user: S.Struct({
    id: Id,
    name: S.String,
  }),
};

export type TableHooks<T> = {
  list: (partial: Partial<T>) => Promise<Readonly<T[]>>;
  get: (id: string) => Promise<T>;
  create: (data: Partial<T>) => Promise<T>;
  update: (data: Partial<T>) => Promise<void>;
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

export default S.Struct({
  competitions: tableHooks(schemas.competition),
  users: tableHooks(schemas.user),
  tracks: tableHooks(schemas.track),
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
