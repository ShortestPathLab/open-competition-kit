import { $ } from "bun";
import type { Source } from "core/hook/component";
import type { ReactNode } from "react";
import { z } from "zod";

export type ClientProps = {};

export { type Source } from "core/hook/component";
export type ComponentOnly = {
  component: (props: ClientProps) => ReactNode;
};
export type ComponentDef = ComponentOnly & {
  path: string;
};

export function defineComponent(def: ComponentDef) {
  return def;
}

export async function makeComponent(def: ComponentDef) {
  const output =
    await $`bunx esbuild ${def.path} --bundle --jsx=transform --external:react --external:react-dom --external:react/jsx-runtime --format=cjs`.quiet();
  console.error(output.stderr.toString("utf-8"));
  return {
    type: "open-competition-kit/hook/component-source",
    source: output.text(),
  } satisfies Source;
}

export function isSource(value: unknown): value is Source {
  return z
    .object({
      type: z.literal("open-competition-kit/hook/component-source"),
      source: z.string(),
    })
    .safeParse(value).success;
}
