import { Effect as E } from "effect";
import type { OpenCompetitionKitHooks } from "../core/hook";
import { OpenCompetitionKitDatabase } from "./db";
import { tables, type DbKey, type WithHooks } from "./hook/db";

export type Table<T> = {
  list: () => Promise<T[]>;
  where: (partial: Partial<T>) => Promise<T[]>;
  create: (data: T) => Promise<void>;
  get: (id: string) => Promise<T>;
  update: (id: string, data: Partial<T>) => Promise<void>;
  delete: (id: string) => Promise<void>;
};

const createAccessor = <T extends DbKey>(
  collection: T,
  ...a: Parameters<OpenCompetitionKitHooks["get"]>
) =>
  E.gen(function* () {
    const db = yield* OpenCompetitionKitDatabase;
    const schema = tables[collection];
    const d = yield* db(...a);
    return {
      get: (id: string) =>
        d.get({
          collection: collection,
          payload: id,
        }),
      list: (partial) =>
        d.list({
          collection: collection,
          payload: partial,
        }),
      create: (data) =>
        d.create({
          collection: collection,
          payload: schema.create.make(data as any),
        }),
      update: (data) =>
        d.update({
          collection: collection,
          payload: schema.update.make(data as any),
        }),
      delete: (id) =>
        d.delete({
          collection: collection,
          payload: id,
        }),
    } satisfies WithHooks<
      (typeof tables)[typeof collection]["full"]["Type"],
      unknown,
      unknown
    >;
  });

export class OpenCompetitionKitCollections extends E.Service<OpenCompetitionKitCollections>()(
  "open-competition-kit/OpenCompetitionKitCollections",
  {
    effect: E.gen(function* () {
      return (...a: Parameters<OpenCompetitionKitHooks["get"]>) =>
        E.gen(function* () {
          return {
            competitions: yield* createAccessor("competition", ...a),
            tracks: yield* createAccessor("track", ...a),
            users: yield* createAccessor("user", ...a),
            enrolments: yield* createAccessor("enrolment", ...a),
          };
        });
    }),
  },
) {}
