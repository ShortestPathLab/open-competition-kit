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

type Result<Out, Error> =
  | {
      error: undefined;
      value: Out;
    }
  | {
      value: undefined;
      error: Error;
    };

type Fn<In extends unknown[], Out, Error = unknown> = (
  ...args: In
) => Promise<Result<Out, Error>>;

type MapEffectToPromise<T> = T extends (...args: infer In) => // Effect case
E.Effect<infer Out, infer Error, never>
  ? Fn<In, Out, Error>
  : // Promise case
  T extends (...args: infer In) => Promise<infer Out>
  ? Fn<In, Out>
  : // Object case
  T extends { [K in infer U]: unknown }
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
    try {
      const result = await get(kit, this.path)(...args);
      return {
        value: E.isEffect(result)
          ? await E.runPromise(result as E.Effect<unknown, unknown, never>)
          : result,
        error: undefined,
      } satisfies Result<unknown, unknown>;
    } catch (e) {
      return {
        error: e,
        value: undefined,
      } satisfies Result<unknown, unknown>;
    }
  },
});

export const { competitions } = kit;

export default kit;
