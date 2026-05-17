import { $ } from "bun";
import type { Hooks } from "@open-competition-kit/core";
import type { Source } from "core/hook/component";
import type { ReactNode } from "react";
import { z } from "zod";

export type ClientProps = {};

export type PropTypes<T = Hooks> = {
  [K in keyof T]: T[K] extends () => Promise<Source<infer R>> ? R
  : T[K] extends Record<string, any> ? PropTypes<T[K]>
  : never;
};

export const $props: PropTypes = null as unknown as any;

export { type Source } from "core/hook/component";
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
  const output =
    await $`bunx esbuild ${def.path} --bundle --jsx=transform --external:react --external:react-dom --external:react/jsx-runtime --format=cjs`.quiet();
  console.error(output.stderr.toString("utf-8"));
  return {
    type: "open-competition-kit/hook/component-source",
    source: output.text(),
  } satisfies Source<TProps>;
}

export function isSource(value: unknown): value is Source {
  return z
    .object({
      type: z.literal("open-competition-kit/hook/component-source"),
      source: z.string(),
    })
    .safeParse(value).success;
}
