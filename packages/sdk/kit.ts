import { BunContext } from "@effect/platform-bun";
import {
  OpenCompetitionKit,
  OpenCompetitionKitConfig,
  OpenCompetitionKitDatabase,
  OpenCompetitionKitHooks,
  OpenCompetitionKitPackages,
  type OpenCompetitionKitApi,
} from "@open-competition-kit/core";
import { OpenCompetitionKitCollections } from "@open-competition-kit/core/collections";
import { Effect as E, Layer as L, Logger } from "effect";
import { once } from "es-toolkit";
import { get } from "es-toolkit/compat";
import DeepProxy from "proxy-deep";
import type { Result } from "./result";
import { Youch } from "youch";

/**
 * One instance, shared by everything that reaches for a package.
 *
 * Declared once and provided from this constant everywhere below, because a layer
 * is memoised by reference: building it twice would give the config schemas and
 * the hook chain a registry each, which is the duplication the registry exists to
 * remove and which stops being harmless as soon as a loader owns a process.
 */
const OpenCompetitionKitPackagesLive = OpenCompetitionKitPackages.Default;

const OpenCompetitionKitConfigLive = L.provide(
  OpenCompetitionKitConfig.Default,
  OpenCompetitionKitPackagesLive,
);

const OpenCompetitionKitHooksLive = OpenCompetitionKitHooks.Default.pipe(
  L.provide(OpenCompetitionKitConfigLive),
  L.provide(OpenCompetitionKitPackagesLive),
);

const OpenCompetitionKitDatabaseLive = L.provide(
  OpenCompetitionKitDatabase.Default,
  OpenCompetitionKitHooksLive,
);
const OpenCompetitionKitCollectionsLive = L.provide(
  OpenCompetitionKitCollections.Default,
  OpenCompetitionKitDatabaseLive,
);

const OpenCompetitionKitLive = OpenCompetitionKit.Default.pipe(
  L.provide(OpenCompetitionKitHooksLive),
  L.provide(OpenCompetitionKitDatabaseLive),
  L.provide(OpenCompetitionKitCollectionsLive),
  L.provide(OpenCompetitionKitConfigLive),
  L.provide(OpenCompetitionKitPackagesLive),
);

export const init = once(
  async () =>
    await E.runPromise(
      OpenCompetitionKit.pipe(
        E.tapError((e) => E.logError(e)),
        E.provide(OpenCompetitionKitLive),
        E.provide(BunContext.layer),
        E.provide(Logger.pretty),
      ),
    ),
);

type Fn<In extends unknown[], Out, Error = unknown> = (...args: In) => Promise<Result<Out, Error>>;

export type MapEffectToPromise<T> =
  // Effect case
  T extends (...args: infer In) => E.Effect<infer Out, infer Error, never>
    ? Fn<In, Out, Error>
    : // Promise case
      T extends (...args: infer In) => Promise<infer Out>
      ? Fn<In, Out>
      : // Other return type case
        T extends (...args: infer In) => infer Out
        ? Fn<In, Out>
        : // Object case
          T extends { [K in infer U]: unknown }
          ? { [K in U]: MapEffectToPromise<T[K]> }
          : never;

type Kit = MapEffectToPromise<Awaited<ReturnType<typeof init>>>;

export const kit = new DeepProxy({} as OpenCompetitionKitApi & Kit, {
  get() {
    return this.nest(() => {});
  },
  async apply(_target, _this, args) {
    try {
      const kit = await init();
      const result = await get(kit, this.path)(...args);
      return {
        value: E.isEffect(result)
          ? await E.runPromise(
              result.pipe(
                E.tapError((e) => E.logError(e)),
                E.provide(Logger.pretty),
              ) as E.Effect<unknown, unknown, never>,
            )
          : result,
        error: undefined,
      } satisfies Result<unknown, unknown>;
    } catch (e) {
      const youch = new Youch();
      console.error(await youch.toANSI(e));
      return { error: e, value: undefined } satisfies Result<unknown, unknown>;
    }
  },
});
