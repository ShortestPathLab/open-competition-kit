/**
 * Assembling one callable per hook out of every package that implements it.
 *
 * The implementations for a hook stay a list, and the callable is built from that
 * list rather than folded together as the packages are walked. Which link a caller
 * ends up in is then answerable: the position of a package is still there to be
 * named in an error, and a link nobody can reach is one a caller could skip.
 *
 * The arrangement it replaces composed each function into the next as it folded,
 * so a `next` was a closure captured at merge time. That is enough for two JS
 * modules sharing a process and for nothing beyond it, since a link living behind
 * a process boundary has nowhere to put a closure over the link beneath it. What a
 * link actually is stays the loader's business here, and an out-of-process one
 * arrives as a wrapper function like any other.
 *
 * Order is the order of `with:` and the last entry is outermost. `next` walks
 * inward, and the innermost link is called without a usable one, which is what
 * terminates the `?? all` idiom the gates are written in.
 */
import { isFunction, omit, uniq } from "es-toolkit";
import { modeOf, type HookMode } from "./mode";

type Fn = (...args: readonly unknown[]) => unknown;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * `Package` metadata, which is not a hook and must not be walked as one.
 *
 * `config` is the one that matters. It holds validation schemas, and a schema
 * carries functions, so walking it would chain those into each other: the
 * deep-merge-two-schemas-into-neither problem `Package` already warns about.
 * `decode` drops the key afterwards either way, so this saves the work rather
 * than changing the result.
 */
const METADATA = ["name", "description", "version", "config"] as const;

/**
 * The declared fields of a schema struct, where there are any.
 *
 * Not `isPlainObject`: an Effect schema is callable, so a struct arrives here as
 * a function carrying a `fields` record.
 */
const fieldsOf = (schema: unknown): Record<string, unknown> | undefined => {
  if (schema === null || (typeof schema !== "object" && typeof schema !== "function")) {
    return undefined;
  }
  const fields = (schema as { fields?: unknown }).fields;
  return isPlainObject(fields) ? fields : undefined;
};

/** Undefined when no package implements this hook. */
const callableOf = (fns: readonly Fn[], mode: HookMode): Fn | undefined => {
  if (mode === "override") return fns[fns.length - 1];

  // Built here rather than folded in as the list is walked, so the list survives
  // as data: which package sits at which position is what an error has to name,
  // and a link that cannot be reached is one a caller may eventually want to skip.
  const link = (index: number): Fn | undefined => {
    const fn = fns[index];
    if (!fn) return undefined;
    return (...args) => fn(...args, link(index - 1));
  };
  return link(fns.length - 1);
};

/**
 * One value from every package that had something to say at this position.
 *
 * A position holding functions is a hook. A position holding objects is a group
 * of hooks and is walked. Anything else is a plain value, and the last package to
 * set it wins, which is what the merge before this did and what `with:` order
 * implies. Arrays fall in that last category rather than being merged
 * element-wise; no hook has an array value, and quietly interleaving two would be
 * a worse answer than taking one.
 */
const merge = (values: readonly unknown[], schema: unknown): unknown => {
  const fns = values.filter(isFunction) as Fn[];
  if (fns.length > 0) return callableOf(fns, modeOf(schema));

  const objects = values.filter(isPlainObject);
  if (objects.length > 0) {
    const fields = fieldsOf(schema);
    return Object.fromEntries(
      uniq(objects.flatMap((object) => Object.keys(object))).map((key) => [
        key,
        merge(
          objects.map((object) => object[key]).filter((value) => value !== undefined),
          fields?.[key],
        ),
      ]),
    );
  }

  return values.at(-1);
};

/**
 * The hooks of every package in `with:` order, as one object.
 *
 * `schema` is `Hooks`, and is read only for the mode of each leaf. A position it
 * does not declare still assembles, since `decode` is what decides whether a
 * package may contribute there and it runs after this.
 */
export const assembleHooks = (
  modules: readonly unknown[],
  schema: unknown,
): Record<string, unknown> =>
  merge(
    modules.filter(isPlainObject).map((module) => omit(module, [...METADATA])),
    schema,
  ) as Record<string, unknown>;
