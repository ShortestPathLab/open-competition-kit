import { BunContext } from "@effect/platform-bun";
import {
  OpenCompetitionKit,
  OpenCompetitionKitConfig,
  OpenCompetitionKitDatabase,
  OpenCompetitionKitHooks,
  type OpenCompetitionKitApi,
} from "core";
import { Effect as E, Layer as L } from "effect";
import { get, once } from "lodash-es";
import DeepProxy from "proxy-deep";

const OpenCompetitionKitHooksLive = L.provide(
  OpenCompetitionKitHooks.Default,
  OpenCompetitionKitConfig.Default
);

const OpenCompetitionKitDatabaseLive = L.provide(
  OpenCompetitionKitDatabase.Default,
  OpenCompetitionKitHooksLive
);

const OpenCompetitionKitLive = L.provide(
  OpenCompetitionKit.Default,
  OpenCompetitionKitDatabaseLive
);

export const init = once(
  async () =>
    await E.runPromise(
      OpenCompetitionKit.pipe(
        E.provide(OpenCompetitionKitLive),
        E.provide(BunContext.layer)
      )
    )
);

type MapEffectToPromise<T> = T extends (
  ...args: infer In
) => E.Effect<infer Out, any, never>
  ? (...args: In) => Promise<Out>
  : T extends { [K in infer U]: unknown }
  ? {
      [K in U]: MapEffectToPromise<T[K]>;
    }
  : never;
type Kit = MapEffectToPromise<Awaited<ReturnType<typeof init>>>;

const kit = new DeepProxy({} as OpenCompetitionKitApi & Kit, {
  get() {
    return this.nest(() => {});
  },
  async apply(_target, _this, args) {
    const kit = await init();
    const result = await get(kit, this.path)(...args);
    return E.isEffect(result)
      ? await E.runPromise(result as E.Effect<unknown, unknown, never>)
      : result;
  },
});

export const { competitions } = kit;

export default kit;
