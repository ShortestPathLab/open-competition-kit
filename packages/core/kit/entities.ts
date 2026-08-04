import { Effect as E } from "effect";
import { omit } from "es-toolkit";
import { access } from "../config/access";
import { flow } from "../utils/flow";
import { withCollectionUtilities, withMergeConfig } from "./collection-utils";
import { CollectionOwnerError } from "./errors";
import type { Runtime } from "./runtime";

/** The things an organiser declares: competitions, their tracks, and the users. */
export const createEntities = ({ config, hooks, instance }: Runtime) => {
  const competitions = flow(
    instance.competitions,
    (c) => withMergeConfig(c, (id) => access({ competitions: id }, config)),
    (c) =>
      withCollectionUtilities(
        c,
        () => E.fail(new CollectionOwnerError()),
        () => c.list({}),
      ),
  );

  const users = withCollectionUtilities(
    instance.users,
    () => E.fail(new CollectionOwnerError()),
    () => instance.users.list({}),
  );

  const tracks = flow(
    instance.tracks,
    (c) =>
      withMergeConfig(c, (id) =>
        access({ competitions: { tracks: id } }, config),
      ),
    (c) =>
      withCollectionUtilities(
        c,
        (track) => competitions.get(track.competition),
        (competition) => c.list({ competition: competition.id }),
      ),
  );

  const forms = {
    get: (id: string) =>
      access({ competitions: { tracks: id } }, config).pipe(
        E.andThen((c) => c.form),
      ),
    load: (track: string, user: string) =>
      E.gen(function* () {
        const def = (yield* access(
          { competitions: { tracks: track } },
          config,
        )).form;
        const loaded = yield* hooks.do((h) => h.form.loader({ def, user }), {
          competitions: { tracks: track },
        });
        return loaded?.def ?? def;
      }),
  };

  const leaderboards = {
    get: (id: string) => access({ competitions: { leaderboards: id } }, config),
    load: (leaderboard: string) =>
      E.gen(function* () {
        const raw = yield* access(
          { competitions: { leaderboards: leaderboard } },
          config,
        );
        // `propagateExtendable` stamps `with` onto every object it walks, so it
        // lands inside `options` too, where it means nothing and would show up to
        // renderers as a phantom setting. Drop it.
        const def =
          raw?.options ?
            { ...raw, options: omit(raw.options, ["with"]) }
          : raw;
        const owner = config.competitions.find((c) =>
          c.leaderboards.some((l) => l.id === leaderboard),
        );
        const loaded = yield* hooks.do(
          (h) => h.leaderboard.loader({ def, competition: owner?.id ?? "" }),
          { competitions: { leaderboards: leaderboard } },
        );
        // Fall back to what the config declared rather than blanking the board: a
        // leaderboard with no loader should still render its literal `items`.
        return loaded?.def ?? { ...def, items: def.items ?? [] };
      }),
  };

  return { competitions, users, tracks, forms, leaderboards };
};

export type Entities = ReturnType<typeof createEntities>;
