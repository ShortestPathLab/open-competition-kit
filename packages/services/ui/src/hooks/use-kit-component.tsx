import { createServerFn, useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery } from "node_modules/@tanstack/react-query/build/modern";
import {
  unsafe,
  hooks,
  isSource,
  Hooks,
  Config,
  Source,
  isComponent,
} from "sdk";
import z from "zod";
import { getByPath, Path, PathValue } from "@clickbar/dot-diver";
import { assert } from "es-toolkit";

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

export function useKitComponent(
  hook: ComponentHookPath,
  accessor?: Path<Config>,
) {
  const getKitComponentModuleFn = useServerFn(getKitComponentModule);
  const { data: KitComponent } = useSuspenseQuery({
    queryKey: ["kit-component", hook, accessor],
    queryFn: async () => {
      const { source } = await getKitComponentModuleFn({
        data: { hook, accessor },
      });
      const module = (await import(`data:text/javascript;base64,${source}`))
        .default;
      assert(isComponent(module), "Hook output is is not a component");
      return module.component;
    },
  });
  return KitComponent;
}
