import { createServerFn } from "@tanstack/react-start";
import { betterAuth, BetterAuthOptions } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { mapValues, once, toMerged } from "es-toolkit";
import { config, unsafe } from "sdk";
import { z } from "zod";

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
    .parse((await unsafe(config.get())).auth),
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

export const auth = once(async () =>
  betterAuth({
    ...(await options()),
    plugins: [tanstackStartCookies()], // make sure this is the last plugin in the array
  }),
);
