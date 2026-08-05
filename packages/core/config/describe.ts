/**
 * The config as an editor sees it.
 *
 * The same question the validator asks, answered for a different audience: which
 * packages added fields here, what are those fields called, and what is in them
 * right now. Both go through `walkNodes`, so the tree an organiser is shown is
 * the tree their config was checked against.
 *
 * Everything returned is serialisable. A schema is not, and neither is the
 * package module it came from, so the schema is used here and left here: the
 * caller gets labels, descriptions, values and the name of the package that
 * claimed each field.
 */
import { Effect as E } from "effect";
import { isEqual } from "es-toolkit";
import type { Meta, Shape } from "../common/shape";
import type { SerialisableValue } from "../serialisable";
import type { NodeKind, ResolvedExtension } from "./extension";
import { CORE_KEYS, collectExtensions, type Resolve } from "./validate";
import { walkNodes, type Node } from "./walk";

export type ConfigFieldDescription = Shape &
  Meta & {
    /**
     * What the config currently has here, when it has anything.
     *
     * Absent for a field the organiser never set, which an editor renders as an
     * empty input rather than as a value of nothing.
     */
    value?: SerialisableValue;
  };

/** One package's contribution to one node, as an editor should draw it. */
export type ConfigSectionDescription = {
  /** The `with:` entry that declared these fields. */
  source: string;
  group?: { id: string; label: string };
  fields: ConfigFieldDescription[];
};

export type ConfigNodeDescription = {
  kind: NodeKind;
  /** Dotted path, matching the one a validation error would name. */
  path: string;
  label: string;
  /** Fields core itself declares here, so an editor can show the whole node. */
  coreKeys: readonly string[];
  sections: ConfigSectionDescription[];
};

const isSerialisable = (value: unknown): value is SerialisableValue =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  (typeof value === "object" && value !== null);

/**
 * The fields one extension contributes here.
 *
 * `shape` decides the order and the wording when a package supplied one, because
 * a validation schema has no way to say which field comes first or what to call
 * it on screen. A package that supplied none still gets an editable section: the
 * field names come from what its schema accepted, which is the honest fallback
 * and keeps the cost of contributing config low.
 */
const fieldsOf = (extension: ResolvedExtension, node: Node): ConfigFieldDescription[] => {
  const valueOf = (id: string) => {
    const raw = node[id];
    return raw !== undefined && isSerialisable(raw) ? { value: raw as SerialisableValue } : {};
  };

  if (extension.shape?.length) {
    return extension.shape.map((field) => ({ ...field, ...valueOf(field.id) }));
  }

  const result = extension.schema["~standard"].validate(node);
  // Only the synchronous case. An editor's field list is not worth making the
  // whole description asynchronous for, and a package that wants its fields
  // named should supply a `shape` rather than rely on this at all.
  if (result instanceof Promise || result.issues) return [];

  return Object.keys((result.value ?? {}) as Node)
    .filter((key) => key in node)
    .map((id) => ({ id, ...valueOf(id) }));
};

/**
 * One section per declaration, rather than one per package that made it.
 *
 * A field may be declared by several packages, and several deliberately do it: a
 * leaderboard renderer ships the loader it needs and declares the loader's fields
 * along with it, so installing two renderers means two identical declarations.
 * Validation treats that as one declaration contributed twice. An editor showing
 * "Row source" once per renderer would be showing the organiser a consequence of
 * how packaging works, which is not a thing they can act on.
 *
 * Kept is the first, so the section is attributed to the outermost package that
 * declared it and the order an organiser sees follows `with:`.
 */
const dedupe = (sections: ConfigSectionDescription[]) =>
  sections.filter(
    (section, index) =>
      sections.findIndex(
        (other) => other.group?.id === section.group?.id && isEqual(other.fields, section.fields),
      ) === index,
  );

/**
 * Every node an organiser could edit, with the package fields that apply to it.
 *
 * Nodes with nothing contributed are kept rather than filtered out, since core's
 * own fields are still worth showing and a caller that only wants the
 * package-configured ones can drop the empty sections itself.
 */
export const describeConfig = <R = never>(
  config: Node,
  resolve: Resolve<R>,
): E.Effect<ConfigNodeDescription[], never, R> =>
  E.gen(function* () {
    const out: ConfigNodeDescription[] = [];

    for (const { node, kind, path, label, installed } of walkNodes(config)) {
      const { byKind } = yield* collectExtensions(installed, resolve);
      const extensions = byKind.get(kind) ?? [];

      out.push({
        kind,
        path,
        label,
        coreKeys: CORE_KEYS[kind],
        sections: dedupe(
          extensions
            .map((extension) => ({
              source: extension.source,
              ...(extension.group ? { group: extension.group } : {}),
              fields: fieldsOf(extension, node),
            }))
            .filter((section) => section.fields.length > 0),
        ),
      });
    }

    return out;
  });
