import { createIsomorphicFn, createServerFn } from "@tanstack/react-start";
import { betterAuth, BetterAuthOptions } from "better-auth";
import { mapValues, omit, once, toMerged } from "es-toolkit";
import { config, unsafe } from "sdk";
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
  const { email, ...social } = await authConfig();
  return {
    emailAndPassword: email
      ? { enabled: true, ...email.providerOptions }
      : undefined,
    socialProviders: mapValues(social, (a) => a.providerOptions as any),
    ...Object.values(authConfig).reduce(
      (prev, next) => toMerged(prev, next.betterAuthOptions),
      {},
    ),
  } satisfies Partial<BetterAuthOptions>;
});

const options = once(_options);

export const auth = once(async () => {
  await createIsomorphicFn()
    .client(() => {})
    .server(async () => {
      const { migrate } = await import("./migrate.server");
      await migrate();
    })();
  return betterAuth({
    ...(await options()),
    ...getAuthBaseConfig(),
  });
});

export const getAuthConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const config = await authConfig();
    const { email, ...social } = config;
    return {
      emailEnabled: !!email,
      socialProviders: Object.keys(social),
    };
  },
);
