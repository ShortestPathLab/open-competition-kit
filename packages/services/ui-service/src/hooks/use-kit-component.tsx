import { Loader } from "*/components/loader";
import { getByPath, Path, PathValue } from "@clickbar/dot-diver";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { CatchBoundary } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { assert } from "es-toolkit";
import hash from "object-hash";
import { useMemo } from "react";
import root from "react-shadow";
import {
  type ComponentOnly,
  ConfigAccessor,
  hooks,
  Hooks,
  isSource,
  Source,
  unsafe,
} from "@open-competition-kit/sdk";
import z from "zod";

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

/**
 * Every hook that answers with a component, and what each one takes and gives.
 *
 * Both halves come off one conditional so they cannot disagree. The shape is
 * deliberately loose about arity: a `componentSource` such as `form.ui` takes
 * nothing, while `surface.view` is asked for one view by id, and a check written
 * only for the first would leave the second untyped at every call site.
 */
type ComponentHooks = OmitNever<{
  [K in Path<Hooks>]: PathValue<Hooks, K> extends (
    (...args: infer A) => Promise<Source<infer R> | undefined>
  ) ?
    {
      args: A extends [infer First, ...unknown[]] ? First : undefined;
      props: R;
    }
  : never;
}>;

type ComponentHookPath = keyof ComponentHooks;

const getKitComponentModule = createServerFn()
  .inputValidator(
    z.object({
      hook: z.string().pipe(z.custom<ComponentHookPath>()),
      accessor: jsonSchema.pipe(z.custom<ConfigAccessor>()).optional(),
      args: jsonSchema.optional(),
    }),
  )
  .handler(async ({ data: { hook, accessor, args } }) => {
    const result = await unsafe(
      // The validator can only promise this is JSON. Which hook it belongs to,
      // and so what shape it should be, is decided at the call site by
      // `ComponentHooks[T]["args"]`.
      hooks.do((w) => getByPath(w, hook)(args as never), accessor),
    );
    // Also how "no package owns this view" arrives: the chain answers with
    // undefined, which is not a component, and the caller draws its fallback.
    assert(isSource(result), "Hook output is is not a component");
    return result;
  });

function isComponent(module: unknown): module is ComponentOnly<any> {
  return z.object({ component: z.function() }).safeParse(module).success;
}

const cache: Record<string, ComponentOnly<any>> = {};

export function useKitComponent<T extends ComponentHookPath>(
  hook: T,
  {
    accessor,
    args,
    query,
  }: {
    accessor?: ConfigAccessor;
    args?: ComponentHooks[T]["args"];
    query?: Partial<UseQueryOptions>;
  } = {},
) {
  const getKitComponentModuleFn = useServerFn(getKitComponentModule);
  const {
    data: KitComponent,
    isPending,
    isError,
  } = useQuery({
    // A failed bundle is usually a broken import rather than a blip, so this
    // does not sit there retrying. One more attempt is worth it because
    // `lazyComponent` only memoises a success, so the second call rebuilds.
    retry: 1,
    ...(query as unknown as Record<string, never>),
    queryKey: ["kit-component", hook, accessor, args],
    staleTime: Infinity,
    queryFn: async () => {
      // Keyed by the arguments too: two views share this hook path and accessor
      // and differ only by id, so leaving them out handed the first view's
      // bundle to the second.
      const id = hash({ hook, accessor, args: args ?? null });

      if (cache[id]) {
        return cache[id].component as ComponentOnly<
          ComponentHooks[T]["props"]
        >["component"];
      }
      const { source } = await getKitComponentModuleFn({
        data: { hook, accessor, args },
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
        ComponentHooks[T]["props"]
      >["component"];
    },
  });

  const Component = useMemo(
    () => (props: ComponentHooks[T]["props"]) => {
      // No font rule here on purpose. `font-family` inherits across the shadow
      // boundary, so a renderer that declares nothing picks up the app's Inter.
      // The rule that used to sit here named Geist, which nothing loads, and so
      // dropped every kit component to the browser's default serif.
      return KitComponent ?
          <CatchBoundary getResetKey={() => "reset"} onCatch={console.error}>
            <root.div>
              <KitComponent {...props} />
            </root.div>
          </CatchBoundary>
        : <Loader />;
    },
    [KitComponent],
  );

  // The query state comes back alongside the component because the component
  // alone cannot tell a caller which of the two silences it is in. This used to
  // swallow the error and return null, which the renderer read as "still
  // loading" and left a spinner on the page for good.
  return { Component, isPending, isError };
}
