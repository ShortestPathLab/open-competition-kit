import { Effect as E, Either } from "effect";
import type { OpenCompetitionKitHooks } from "../core/hook";
import { OpenCompetitionKitDatabase } from "./db";
import { tables, type DbKey, type WithHooks } from "./hook/db";
import { isFunction } from "es-toolkit";
import { OpenCompetitionKitConfig } from "./config";
import { traverse } from "./utils/traverse";

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
      get: (id: string) => d.get({ collection: collection, payload: id }),
      list: (partial) => d.list({ collection: collection, payload: partial }),
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
      delete: (id) => d.delete({ collection: collection, payload: id }),
      claim: (id, where, set) =>
        d.claim({
          collection: collection,
          payload: { id, where: where as any, set: set as any },
        }),
    } satisfies WithHooks<
      (typeof tables)[typeof collection]["create"]["Type"],
      (typeof tables)[typeof collection]["update"]["Type"],
      (typeof tables)[typeof collection]["full"]["Type"],
      unknown,
      unknown
    >;
  });

const upsert = <TCreate, TUpdate extends { id: string }, TFull, E, C>(
  table: WithHooks<TCreate, TUpdate, TFull, E, C>,
  payload: TCreate & TUpdate,
) =>
  E.either(table.get(payload.id)).pipe(
    E.andThen((e) =>
      Either.match(e, {
        onLeft: () => table.create(payload),
        onRight: () => table.update(payload),
      }),
    ),
  );

export class OpenCompetitionKitCollections extends E.Service<OpenCompetitionKitCollections>()(
  "open-competition-kit/OpenCompetitionKitCollections",
  {
    // Building this service needs no effects of its own, so the generator has
    // nothing to yield. E.gen is still the shape Service expects.
    // oxlint-disable-next-line require-yield
    effect: E.gen(function* () {
      return (...a: Parameters<OpenCompetitionKitHooks["get"]>) =>
        E.gen(function* () {
          const configService = yield* OpenCompetitionKitConfig;
          const config = yield* configService.config;
          const db = {
            competitions: yield* createAccessor("competition", ...a),
            tracks: yield* createAccessor("track", ...a),
            users: yield* createAccessor("user", ...a),
            enrolments: yield* createAccessor("enrolment", ...a),
            submissions: yield* createAccessor("submission", ...a),
            jobs: yield* createAccessor("job", ...a),
            context: yield* createAccessor("context", ...a),
            files: yield* createAccessor("file", ...a),
          };
          const ensureDb = yield* E.once(
            E.all(
              config.competitions.flatMap((c) => [
                upsert(db.competitions, { id: c.id }),
                ...c.tracks.map((t) => upsert(db.tracks, { id: t.id, competition: c.id })),
              ]),
            ),
          );
          return traverse(db, (f) => {
            if (isFunction(f)) return (...args: any[]) => E.zipRight(ensureDb, f(...args));
            return f;
          });
        });
    }),
  },
) {}
