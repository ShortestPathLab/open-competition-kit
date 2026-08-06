/**
 * Where the extendable nodes are, and which packages are installed on each.
 *
 * The one place that knows a track is reached through `competitions[].tracks[]`.
 * Both readers of that knowledge go through here: the validator, which checks
 * each node against the packages installed on it, and the config editor, which
 * asks those same packages what their fields are called. Two copies of this
 * mapping would drift, and the second one to drift would be the one that decides
 * whether an organiser's config boots.
 */
import { uniq } from "es-toolkit";
import type { NodeKind } from "./extension";

export type Node = Record<string, unknown>;

/** Keys and indices from the root of the document down to a node. */
export type Keys = readonly (string | number)[];

export type WalkedNode = {
  node: Node;
  kind: NodeKind;
  /** Dotted path, e.g. `competitions.fit5047.tracks.main`. */
  path: string;
  /**
   * The same node, addressed the way the YAML document holds it.
   *
   * `path` names a competition by its id because that is what an organiser can
   * search their file for; the file has it at an index. Both are produced here
   * so the writer that puts an edit back has the mapping from the one place that
   * knows the shape, rather than reconstructing it from a dotted string and
   * getting `tracks.main` wrong the first time somebody names a track `2`.
   */
  keys: Keys;
  /** What to call this node on screen. */
  label: string;
  /** Every package installed at this point, outermost first. */
  installed: readonly string[];
};

export const isNode = (value: unknown): value is Node =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The `with:` list a node authored, added to the one it inherited. */
const withAt = (node: Node, inherited: readonly string[]) =>
  Array.isArray(node.with) ? uniq([...inherited, ...(node.with as string[])]) : inherited;

/**
 * A findable name for a node.
 *
 * An id where there is one, since `competitions.fit5047.tracks.main` can be
 * searched for in a config file and `competitions.0.tracks.0` sends the reader
 * counting array entries.
 */
const nameOf = (node: Node, fallback: string) =>
  typeof node.id === "string" && node.id ? node.id : fallback;

/**
 * Every extendable node in the config, in document order.
 *
 * Yields live references rather than copies, so a caller that wants to write
 * coerced values back can assign straight onto `node`. Callers that only read
 * are unaffected either way.
 */
export function* walkNodes(config: Node): Generator<WalkedNode> {
  const root = withAt(config, []);
  yield { node: config, kind: "root", path: "config", keys: [], label: "Root", installed: root };

  for (const [key, kind] of [
    ["db", "db"],
    ["files", "files"],
    ["machine", "machine"],
  ] as const) {
    const block = config[key];
    if (!isNode(block)) continue;
    yield {
      node: block,
      kind,
      path: `config.${key}`,
      keys: [key],
      label: key,
      installed: withAt(block, root),
    };
  }

  const competitions = Array.isArray(config.competitions) ? config.competitions : [];

  for (const [index, entry] of competitions.entries()) {
    if (!isNode(entry)) continue;

    const name = nameOf(entry, String(index));
    const path = `config.competitions.${name}`;
    const keys: Keys = ["competitions", index];
    const scope = withAt(entry, root);
    yield { node: entry, kind: "competition", path, keys, label: name, installed: scope };

    const tracks = Array.isArray(entry.tracks) ? entry.tracks : [];
    for (const [trackIndex, track] of tracks.entries()) {
      if (!isNode(track)) continue;

      const trackName = nameOf(track, String(trackIndex));
      const trackPath = `${path}.tracks.${trackName}`;
      const trackKeys: Keys = [...keys, "tracks", trackIndex];
      const trackScope = withAt(track, scope);
      yield {
        node: track,
        kind: "track",
        path: trackPath,
        keys: trackKeys,
        label: trackName,
        installed: trackScope,
      };

      const form = track.form;
      if (!isNode(form)) continue;

      const formScope = withAt(form, trackScope);
      yield {
        node: form,
        kind: "form",
        path: `${trackPath}.form`,
        keys: [...trackKeys, "form"],
        label: `${trackName} form`,
        installed: formScope,
      };

      const shape = Array.isArray(form.shape) ? form.shape : [];
      for (const [fieldIndex, field] of shape.entries()) {
        if (!isNode(field)) continue;
        const fieldName = nameOf(field, String(fieldIndex));
        yield {
          node: field,
          kind: "formField",
          path: `${trackPath}.form.shape.${fieldName}`,
          keys: [...trackKeys, "form", "shape", fieldIndex],
          label: fieldName,
          // A form field declares no `with:` of its own; it inherits the form's.
          installed: formScope,
        };
      }
    }

    if (isNode(entry.runner)) {
      yield {
        node: entry.runner,
        kind: "runner",
        path: `${path}.runner`,
        keys: [...keys, "runner"],
        label: `${name} runner`,
        installed: withAt(entry.runner, scope),
      };
    }

    const leaderboards = Array.isArray(entry.leaderboards) ? entry.leaderboards : [];
    for (const [boardIndex, board] of leaderboards.entries()) {
      if (!isNode(board)) continue;
      const boardName = nameOf(board, String(boardIndex));
      yield {
        node: board,
        kind: "leaderboard",
        path: `${path}.leaderboards.${boardName}`,
        keys: [...keys, "leaderboards", boardIndex],
        label: boardName,
        installed: withAt(board, scope),
      };
    }
  }
}
