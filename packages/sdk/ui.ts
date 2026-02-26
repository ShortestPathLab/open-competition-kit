import { build } from "bun";
import type { Source } from "core/hook/component";
import { assert } from "es-toolkit";
import { has, isObject } from "es-toolkit/compat";
import type { ReactNode } from "react";
import { z } from "zod";

export type ClientProps = {};

export { type Source } from "core/hook/component";
type ComponentDef = {
  component: (props: ClientProps) => ReactNode;
  path: string;
};

export function defineComponent(def: ComponentDef) {
  return def;
}

export async function makeComponent(def: ComponentDef) {
  const { success, outputs } = await build({
    entrypoints: [def.path],
    target: "browser",
  });
  assert(success, "Failed to build component");
  assert(outputs[0]?.kind === "entry-point", "Component is invalid");
  return {
    type: "open-competition-kit/hook/component-source",
    source: await outputs[0].text(),
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

export function isComponent(value: unknown): value is ComponentDef {
  return z
    .object({
      component: z.function(),
      path: z.string(),
    })
    .safeParse(value).success;
}
