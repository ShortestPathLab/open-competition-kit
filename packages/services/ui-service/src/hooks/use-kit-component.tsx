import { Loader } from "*/components/loader";
import { getByPath, Path, PathValue } from "@clickbar/dot-diver";
import { useQuery } from "@tanstack/react-query";
import { CatchBoundary } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { assert } from "es-toolkit";
import hash from "object-hash";
import { useCallback } from "react";
import {
  type ComponentOnly,
  Config,
  hooks,
  Hooks,
  isSource,
  Source,
  unsafe,
  ConfigAccessor,
} from "sdk";
import z from "zod";
import root from "react-shadow";

const literalSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.undefined(),
]);
type Literal = z.infer<typeof literalSchema>;

type Json = Literal | { [key: string]: Json } | Json[];

export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    literalSchema,
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
);

type OmitNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] };
type ComponentHookMap = OmitNever<{
  [K in Path<Hooks>]: PathValue<Hooks, K> extends (
    () => Promise<Source<infer R>>
  ) ?
    R
  : never;
}>;

type ComponentHookPath = keyof ComponentHookMap;

const getKitComponentModule = createServerFn()
  .inputValidator(
    z.object({
      hook: z.string().pipe(z.custom<ComponentHookPath>()),
      accessor: jsonSchema.pipe(z.custom<ConfigAccessor>()).optional(),
    }),
  )
  .handler(async ({ data: { hook, accessor } }) => {
    const result = await unsafe(
      hooks.do((w) => getByPath(w, hook)(), accessor),
    );
    assert(isSource(result), "Hook output is is not a component");
    return result;
  });

function isComponent(module: unknown): module is ComponentOnly<any> {
  return z.object({ component: z.function() }).safeParse(module).success;
}

const cache: Record<string, ComponentOnly<any>> = {};

export function useKitComponent<T extends ComponentHookPath>(
  hook: T,
  accessor?: Path<Config>,
) {
  const getKitComponentModuleFn = useServerFn(getKitComponentModule);
  const { data: KitComponent } = useQuery({
    queryKey: ["kit-component", hook, accessor],
    staleTime: Infinity,
    queryFn: async () => {
      try {
        const id = hash({ hook, accessor });

        if (cache[id]) {
          return cache[id].component as ComponentOnly<
            ComponentHookMap[T]
          >["component"];
        }
        const { source } = await getKitComponentModuleFn({
          data: { hook, accessor },
        });
        const packages = {
          react: await import("react"),
          "react-dom": await import("react-dom"),
          "react/jsx-runtime": await import("react/jsx-runtime"),
        };
        const module = new Function(
          "require",
          `var module = {}; ${source}; return module;`,
        )((p: keyof typeof packages) => packages[p])?.exports?.default;
        assert(isComponent(module), "Hook output is is not a component");
        cache[id] = module;
        return module.component as ComponentOnly<
          ComponentHookMap[T]
        >["component"];
      } catch (e) {
        console.error(e);
        return null;
      }
    },
  });
  return useCallback(
    (props: ComponentHookMap[T]) => {
      return KitComponent ?
          <CatchBoundary getResetKey={() => "reset"} onCatch={console.error}>
            <root.div>
              <style>{"* { font-family: 'Geist' }"}</style>
              <KitComponent {...props} />
            </root.div>
          </CatchBoundary>
        : <Loader />;
    },
    [KitComponent],
  );
}
