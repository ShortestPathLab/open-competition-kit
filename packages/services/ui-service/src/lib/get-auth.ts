import { createIsomorphicFn, createServerFn } from "@tanstack/react-start";
import { betterAuth, BetterAuthOptions } from "better-auth";
import { mapValues, omit, once, toMerged } from "es-toolkit";
import { config, unsafe } from "@open-competition-kit/sdk";
import { z } from "zod";

import { getAuthBaseConfig } from "./auth-base-config";

const _authConfig = createServerFn().handler(async () =>
  z
    .record(
      z.string(),
      z
        .object({
          providerOptions: z.record(z.string(), z.any()),
          betterAuthOptions: z.record(z.string(), z.any()),
          signInParams: z.record(z.string(), z.any()),
          signOutParams: z.record(z.string(), z.any()),
          signUpParams: z.record(z.string(), z.any()),
        })
        .partial(),
    )
    .parse(omit((await unsafe(config.get())).auth, ["with"])),
);

const authConfig = once(_authConfig);

const _options = createServerFn().handler(async () => {
  const providers = await authConfig();
  const { email, ...social } = providers;
  return {
    emailAndPassword: email ? { enabled: true, ...email.providerOptions } : undefined,
    socialProviders: mapValues(social, (a) => a.providerOptions as any),
    // `authConfig` is the memoised function, not the config it returns — taking
    // Object.values of it yielded [] and silently discarded every
    // `betterAuthOptions` block in the config.
    ...Object.values(providers).reduce(
      (prev, next) => toMerged(prev, next.betterAuthOptions ?? {}),
      {},
    ),
  } satisfies Partial<BetterAuthOptions>;
});

const options = once(_options);

/**
 * Memoise only a *successful* result. `once` caches a rejected promise too, so a
 * single cold-start hiccup — a momentary DB blip, a migration that raced — would
 * otherwise be cached and returned to every later request, bricking auth for the
 * whole process until restart. Here a failure clears the cache so the next
 * request retries.
 */
const onceOk = <T>(fn: () => Promise<T>) => {
  let cached: Promise<T> | undefined;
  return () => {
    if (!cached) {
      cached = fn().catch((e) => {
        cached = undefined;
        throw e;
      });
    }
    return cached;
  };
};

export const auth = onceOk(async () => {
  await createIsomorphicFn()
    .client(() => {})
    .server(async () => {
      const { migrate } = await import("./migrate.server");
      await migrate();
    })();
  // `getAuthBaseConfig()` returns a promise; spreading it un-awaited produced an
  // empty object, so `database` and `plugins` never reached betterAuth and it
  // fell back to its in-memory adapter — auth.sqlite was migrated but never used.
  return betterAuth({ ...(await options()), ...(await getAuthBaseConfig()) });
});

export const getAuthConfig = createServerFn({ method: "GET" }).handler(async () => {
  const config = await authConfig();
  const { email, ...social } = config;
  return { emailEnabled: !!email, socialProviders: Object.keys(social) };
});
