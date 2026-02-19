import { OpenCompetitionKitHooks } from "../core/hook";
import { Effect as E } from "effect";
import { withHooks } from "./hook/db";

export type Table<T> = {
  list: () => Promise<T[]>;
  where: (partial: Partial<T>) => Promise<T[]>;
  create: (data: T) => Promise<void>;
  get: (id: string) => Promise<T>;
  update: (id: string, data: Partial<T>) => Promise<void>;
  delete: (id: string) => Promise<void>;
};

export class OpenCompetitionKitDatabase extends E.Service<OpenCompetitionKitDatabase>()(
  "open-competition-kit/OpenCompetitionKitDatabase",
  {
    effect: E.gen(function* () {
      const hooks = yield* OpenCompetitionKitHooks;
      return (...a: Parameters<typeof hooks.get>) =>
        E.gen(function* () {
          const api = yield* hooks.get(...a);
          return {
            get: hooks.try(api.db.get),
            list: hooks.try(api.db.list),
            create: hooks.try(api.db.create),
            update: hooks.try(api.db.update),
            delete: hooks.try(api.db.delete),
          };
        });
    }),
  },
) {}
