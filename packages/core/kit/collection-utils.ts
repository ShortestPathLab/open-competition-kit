import { Effect as E, Either } from "effect";
import { noop } from "es-toolkit";
import type { WithHooks } from "../hook/db";

/** The shared shape every collection gets: ownership, lookup, and upsert. */
export function withCollectionUtilities<
  TCreate,
  TUpdate extends { id: string },
  TFull extends { id: string },
  U1,
  E1,
  E2,
  E3,
  C1,
  C2,
  C3,
  U2 = U1,
>(
  table: WithHooks<TCreate, TUpdate, TFull, E1, C1>,
  owner: (item: TFull) => E.Effect<U1, E2, C3>,
  of: (owner: U2) => E.Effect<Readonly<TFull[]>, E3, C2>,
) {
  return {
    ...table,
    on: noop,
    of,
    owner,
    find: (...a: Parameters<typeof table.list>) =>
      table.list(...a).pipe(E.andThen((e) => e[0])),
    upsert: (a: TUpdate & TCreate) =>
      E.gen(function* () {
        const prev = yield* E.either(table.get(a.id));
        if (Either.isRight(prev)) {
          yield* table.update(a);
          return { created: false };
        } else {
          yield* table.create(a);
          return { created: true };
        }
      }),
  };
}

/**
 * Overlay a row's config block onto the row itself, so a caller reading a track
 * gets the database record and what the config said about it as one object.
 */
export function withMergeConfig<
  TCreate,
  TUpdate extends { id: string },
  TFull extends { id: string },
  TConfig,
  E1,
  C1,
  E2,
  C2,
>(
  table: WithHooks<TCreate, TUpdate, TFull, E1, C1>,
  getConfig: (id: string) => E.Effect<TConfig, E2, C2>,
) {
  return {
    ...table,
    list: (...a: Parameters<typeof table.list>) =>
      E.gen(function* () {
        const prev = yield* table.list(...a);
        return yield* E.all(
          prev.map((b1) =>
            E.gen(function* () {
              return { ...b1, ...(yield* getConfig(b1.id)) };
            }),
          ),
        );
      }),
    get: (...a: Parameters<typeof table.get>) =>
      E.gen(function* () {
        const prev = yield* table.get(...a);
        return { ...prev, ...(yield* getConfig(prev.id)) };
      }),
    create: (...a: Parameters<typeof table.create>) =>
      E.gen(function* () {
        const prev = yield* table.create(...a);
        return { ...prev, ...(yield* getConfig(prev.id)) };
      }),
  };
}
