import { Spinner } from "*/components/ui/spinner";
import { getByPath, Path, PathValue } from "@clickbar/dot-diver";
import { useQuery } from "@tanstack/react-query";
import { CatchBoundary } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { assert } from "es-toolkit";
import hash from "object-hash";
import * as React from "react";
import { useCallback } from "react";
import {
  Config,
  hooks,
  Hooks,
  isSource,
  Source,
  unsafe,
  type ComponentDef,
} from "sdk";
import z from "zod";

type PathWhereValue<T, V> = {
  [K in Path<T>]: PathValue<T, K> extends V ? K : never;
}[Path<T>];

type ComponentHookPath = PathWhereValue<Hooks, () => Promise<Source>>;

const getKitComponentModule = createServerFn()
  .inputValidator(
    z.object({
      hook: z.string().pipe(z.custom<ComponentHookPath>()),
      accessor: z.string().pipe(z.custom<Path<Config>>()).optional(),
    }),
  )
  .handler(async ({ data: { hook, accessor } }) => {
    const result = await unsafe(
      hooks.do(
        (w) => getByPath(w, hook)(),
        accessor ? (w) => getByPath(w, accessor) : undefined,
      ),
    );
    assert(isSource(result), "Hook output is is not a component");
    return result;
  });

function isComponent(module: unknown): module is ComponentDef {
  return z
    .object({
      component: z.function(),
      path: z.string().optional(),
    })
    .safeParse(module).success;
}

const cache: Record<string, ComponentDef> = {};

export function useKitComponent(
  hook: ComponentHookPath,
  accessor?: Path<Config>,
) {
  const getKitComponentModuleFn = useServerFn(getKitComponentModule);
  const { data: KitComponent } = useQuery({
    queryKey: ["kit-component", hook, accessor],
    staleTime: Infinity,
    queryFn: async () => {
      try {
        const id = hash({ hook, accessor });

        if (cache[id]) return cache[id].component;
        const { source } = await getKitComponentModuleFn({
          data: { hook, accessor },
        });
        const packages = {
          react: await import("react"),
          "react-dom": await import("react-dom"),
        };
        const module = new Function(
          "require",
          `var module = {}; ${source}; return module.exports;`,
        )((p: string) => packages[p as keyof typeof packages])?.default;
        assert(isComponent(module), "Hook output is is not a component");
        cache[id] = module;
        return module.component;
      } catch (e) {
        console.log(e);
        return null;
      }
    },
  });
  return useCallback(() => {
    return KitComponent ? (
      <CatchBoundary getResetKey={() => "reset"} onCatch={console.error}>
        <KitComponent />
      </CatchBoundary>
    ) : (
      <Spinner />
    );
  }, [KitComponent]);
}
