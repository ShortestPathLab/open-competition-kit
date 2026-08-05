import { $ } from "bun";
import type { Hooks } from "@open-competition-kit/core";
import type { Source } from "@open-competition-kit/core/hook/component";
import type { ReactNode } from "react";
import { z } from "zod";

export type ClientProps = {};

export type PropTypes<T = Hooks> = {
  [K in keyof T]: T[K] extends () => Promise<Source<infer R>>
    ? R
    : T[K] extends Record<string, any>
      ? PropTypes<T[K]>
      : never;
};

export const $props: PropTypes = null as unknown as any;

export { type Source } from "@open-competition-kit/core/hook/component";
export type ComponentOnly<TProps = ClientProps> = {
  component: (props: TProps) => ReactNode;
};
export type ComponentDef<TProps = ClientProps> = ComponentOnly<TProps> & {
  path: string;
};

export function defineComponent<TProps>(def: ComponentDef<TProps>) {
  return def;
}

export async function makeComponent<TProps>(def: ComponentDef<TProps>) {
  // `.nothrow()` so a failed bundle is inspected here rather than thrown as a
  // bare ShellError. Without it the shell throws, Effect wraps the throw as "an
  // unknown error occurred in Effect.andThen", and esbuild's actual diagnostics
  // — the unresolved import, the offending file — are lost. A form or
  // leaderboard then just fails to load with nothing pointing at the cause.
  const output =
    await $`bunx esbuild ${def.path} --bundle --jsx=transform --external:react --external:react-dom --external:react/jsx-runtime --format=cjs`
      .quiet()
      .nothrow();

  const diagnostics = output.stderr.toString("utf-8").trim();

  if (output.exitCode !== 0) {
    throw new Error(
      `Failed to bundle component "${def.path}" (esbuild exited ${output.exitCode}).\n\n` +
        `A component is bundled for the browser, so every import it reaches must be\n` +
        `browser-safe — importing a value from a server-only module (Bun's shell,\n` +
        `Effect's node platform) drags node builtins in and fails the bundle.\n\n` +
        `esbuild said:\n${diagnostics || "(no diagnostics)"}`,
    );
  }

  // Warnings do not fail the build but are still worth seeing.
  if (diagnostics) {
    console.warn(`[open-competition-kit] esbuild warnings for "${def.path}":\n${diagnostics}`);
  }

  return {
    type: "open-competition-kit/hook/component-source",
    source: output.text(),
  } satisfies Source<TProps>;
}

/**
 * Build a component once, and remember it — but only once it succeeds.
 *
 * `once` caches a rejected promise too, so a single failed bundle would be
 * handed back to every later request for the life of the process, and even
 * fixing the cause would not clear it short of a restart. This retries on the
 * next call after a failure and memoises only a success — the same reason
 * bundling is worth memoising at all (it is slow) without the trap of pinning a
 * failure forever.
 */
export function lazyComponent<TProps>(def: ComponentDef<TProps>) {
  let cached: Promise<Source<TProps>> | undefined;
  return () => {
    if (!cached) {
      cached = makeComponent(def).catch((error) => {
        cached = undefined;
        throw error;
      });
    }
    return cached;
  };
}

export function isSource(value: unknown): value is Source {
  return z
    .object({
      type: z.literal("open-competition-kit/hook/component-source"),
      source: z.string(),
    })
    .safeParse(value).success;
}
