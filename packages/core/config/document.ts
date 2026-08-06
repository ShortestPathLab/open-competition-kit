/**
 * Putting an edited value back in the file it came from.
 *
 * The half of saving that has to care what the file looks like. Everything else
 * in this folder works on the parsed tree, where a config is data; here it is a
 * document somebody wrote, with comments explaining why each block is the way it
 * is. The example config is a third comments by line count, and they are the
 * difference between a file an organiser can come back to in six months and a
 * pile of keys.
 *
 * So this edits the file rather than rewriting it, through `yaml`'s concrete
 * syntax tree. The CST holds every character of the source, including the
 * whitespace, and stringifying it concatenates what is there; only the tokens
 * that were replaced come out different. Nothing else can promise that. The
 * ordinary document API re-renders every value from the parsed data, which is
 * faithful to the meaning and not to the file: a plain string longer than the
 * line width comes back folded across three lines, and one config in this
 * repository has several.
 *
 * Two things it refuses rather than gets wrong. A value that came from
 * `${{ env(...) }}` is not the organiser's to change here, and writing what they
 * were shown would bake a secret into a committed file. A node that came from
 * `${{ yaml("./other.yaml") }}` is not in this file at all, and appending it
 * would leave the include and the copy disagreeing.
 */
import { isEqual } from "es-toolkit";
import {
  Composer,
  CST,
  isCollection,
  isMap,
  isNode,
  isPair,
  isScalar,
  Parser,
  Scalar,
  stringify,
  type Document,
  type Pair,
  type ParsedNode,
} from "yaml";
import type { SerialisableValue } from "../serialisable";
import { templatesIn } from "./transform";
import type { Keys } from "./walk";

/** New values for one node, addressed the way the document holds it. */
export type DocumentEdit = {
  /** Dotted path, for anything said to a person. */
  path: string;
  /** Keys and indices from the root of the document, from `walkNodes`. */
  keys: Keys;
  /** Field id to its new value, or `undefined` to delete the key. */
  values: Record<string, SerialisableValue | undefined>;
};

export type DocumentIssue = { path: string; message: string };

export type DocumentEditResult = {
  /** The edited document, when every edit could be placed. */
  source?: string;
  issues: DocumentIssue[];
};

/** How far a nested block is indented under the key that holds it. */
const STEP = 2;

const space = (indent: number): CST.SourceToken => ({
  type: "space",
  offset: -1,
  indent: 0,
  source: " ".repeat(indent),
});

const newline = (indent: number): CST.SourceToken => ({
  type: "newline",
  offset: -1,
  indent,
  source: "\n",
});

/**
 * The document, with the file it was cut from still attached.
 *
 * `parseDocument` throws the token stream away, and the token stream is the
 * whole point: it is what carries the comments, the alignment and the long
 * lines that nobody edited.
 */
const parseWithSource = (source: string) => {
  const tokens = [...new Parser().parse(source)];
  const [doc] = [...new Composer({ keepSourceTokens: true }).compose(tokens, true)];
  return { tokens, doc: doc as Document.Parsed | undefined };
};

const render = (tokens: CST.Token[]) => tokens.map((token) => CST.stringify(token)).join("");

/**
 * How a value has to be spelled, decided by the schema rather than by hand.
 *
 * The CST layer knows nothing about types: handed the string "42" as a plain
 * scalar it writes `42`, which reads back as a number. So the ordinary
 * stringifier is asked first, and the style it chose is read off the front of
 * what it produced.
 */
const styleOf = (value: SerialisableValue): Scalar.Type => {
  switch (stringify(value)[0]) {
    case "|":
      return Scalar.BLOCK_LITERAL;
    case ">":
      return Scalar.BLOCK_FOLDED;
    case '"':
      return Scalar.QUOTE_DOUBLE;
    case "'":
      return Scalar.QUOTE_SINGLE;
    default:
      return Scalar.PLAIN;
  }
};

/**
 * The style to force on a value that is replacing another, if any.
 *
 * Nothing, where the value can be written plainly. However the author spelled
 * this field is then how it stays: somebody who wrote `name: "Alpha"` in quotes
 * gets quotes back, and a rewritten `rules:` block stays a block. A value that
 * needs more than plain, because it is text that would otherwise read as a
 * number or because it runs over several lines, overrides that.
 */
const styleWhenReplacing = (value: SerialisableValue) => {
  const style = styleOf(value);
  return style === Scalar.PLAIN ? undefined : style;
};

/** Anything YAML writes on one line as a single value. */
const isScalarValue = (value: SerialisableValue) => value === null || typeof value !== "object";

/**
 * A collection, as tokens.
 *
 * Rendered at the indent it will sit at and then parsed back, so the tokens are
 * ones the parser itself would have produced rather than a string pretending to
 * be a token. `lineWidth: 0` because a value being written now has no previous
 * formatting worth matching, and an unfolded line is easier to read in a diff.
 */
const collectionTokens = (value: SerialisableValue, indent: number) => {
  const body = stringify(value, { lineWidth: 0, flowCollectionPadding: false })
    .trimEnd()
    .split("\n")
    .map((line) => (line ? " ".repeat(indent) + line : line))
    .join("\n");

  const [document] = [...new Parser().parse(`${body}\n`)];
  return document?.type === "document" ? document.value : undefined;
};

/**
 * The tokens between a key and its value, for the shape the value now has.
 *
 * A scalar sits after `: ` on the same line and a collection starts on the next
 * one, so changing one into the other means changing what is between them. Left
 * alone when the shape has not changed, which is nearly always, and which is how
 * an unusual layout somebody chose survives having its value edited.
 */
const separatorFor = (sep: CST.SourceToken[], indent: number, inline: boolean) => {
  const indicator = sep.find((token) => token.type === "map-value-ind");
  // A key that is not in the file has no separator at all, so there is nothing
  // to leave alone and one has to be built.
  if (indicator && !sep.some((token) => token.type === "newline") === inline) return sep;

  const colon = indicator ?? {
    type: "map-value-ind" as const,
    offset: -1,
    indent,
    source: ":",
  };

  return inline ? [colon, space(1)] : [colon, newline(indent)];
};

/** What is at a path, as plain data rather than as document nodes. */
const plainAt = (doc: Document, keys: readonly (string | number)[]) => {
  const found = doc.getIn(keys, true);
  return isNode(found) ? (found.toJS(doc) as unknown) : found;
};

/** Every interpolation anywhere inside a value, however deeply nested. */
const templatesUnder = (value: unknown): string[] => {
  if (typeof value === "string") return templatesIn(value);
  if (Array.isArray(value)) return value.flatMap(templatesUnder);
  if (value && typeof value === "object") return Object.values(value).flatMap(templatesUnder);
  return [];
};

/** The deepest part of a path that is actually in the document. */
const deepestIn = (doc: Document, keys: Keys) => {
  let depth = 0;
  for (let length = 1; length <= keys.length; length++) {
    if (!doc.hasIn(keys.slice(0, length))) break;
    depth = length;
  }
  return { depth, value: depth === 0 ? undefined : plainAt(doc, keys.slice(0, depth)) };
};

/**
 * Why a node the editor knows about is not in this file.
 *
 * Nearly always an include. `walkNodes` ran over the resolved tree, where a
 * competition spliced in by `${{ yaml(...) }}` looks exactly like one written
 * here, so the first this is noticed is when somebody saves.
 */
const missing = (doc: Document, edit: DocumentEdit): string => {
  const { depth, value } = deepestIn(doc, edit.keys);
  const templates = typeof value === "string" ? templatesIn(value) : [];

  if (templates.length) {
    return (
      `This part of the config comes from ${templates[0]}, so it is not in this file. ` +
      `Edit the file that ${templates[0]} points at.`
    );
  }

  const reached = edit.keys.slice(0, depth).join(".") || "the top of the file";
  return (
    `Not found in the config file. The path stops at ${reached}, so the file has ` +
    `changed since this page loaded.`
  );
};

/** The pair for one field of a map, and the tokens behind it. */
const pairIn = (map: ReturnType<Document["getIn"]>, field: string) => {
  if (!isMap(map)) return undefined;
  return (map.items as Pair<ParsedNode, ParsedNode | null>[]).find(
    (item) => isPair(item) && isScalar(item.key) && item.key.value === field,
  );
};

/** A value as the tokens that hold it, whatever shape it is. */
const valueTokens = (value: SerialisableValue, indent: number) =>
  isScalarValue(value)
    ? CST.createScalarToken(String(value), {
        indent: indent + STEP,
        type: styleOf(value),
        end: [newline(indent)],
      })
    : collectionTokens(value, indent + STEP);

/**
 * Make sure the block ends on a line of its own.
 *
 * A file whose last line has no newline after it is ordinary enough, and
 * appending to it without this would put the new key on the end of the old one.
 * The newline belongs to whatever is deepest and last, which is where the file
 * currently stops.
 */
const closeLastLine = (token: CST.Token | undefined | null, indent: number): void => {
  if (!token) return;

  if (token.type === "block-map" || token.type === "block-seq") {
    closeLastLine(token.items.at(-1)?.value, indent);
    return;
  }

  if (token.type === "block-scalar") {
    if (!token.source.endsWith("\n")) token.source += "\n";
    return;
  }

  // The last value in a file that stops mid-line has no `end` at all, rather
  // than an empty one, so there is nothing to push onto.
  if (CST.isScalar(token) || token.type === "flow-collection") {
    token.end = [...(token.end ?? []), newline(indent)];
  }
};

/**
 * One value, into the document.
 *
 * `setScalarValue` is what keeps a comment: it rewrites the token in place, so
 * whatever was written beside the value stays beside it. Everything else here is
 * about the two cases it does not cover, a key that is not in the file yet and a
 * value that is a whole block.
 */
const place = (
  block: CST.BlockMap,
  pair: Pair<ParsedNode, ParsedNode | null> | undefined,
  field: string,
  value: SerialisableValue,
): string | undefined => {
  const indent = block.indent;
  const inline = isScalarValue(value);
  const item = pair?.srcToken;

  if (item && "key" in item) {
    if (inline && item.value && CST.isScalar(item.value)) {
      CST.setScalarValue(item.value, String(value), {
        type: styleWhenReplacing(value),
        afterKey: true,
      });
      return undefined;
    }

    const replacement = valueTokens(value, indent);
    if (!replacement) return `\`${field}\` could not be written as YAML.`;

    item.sep = separatorFor(item.sep ?? [], indent, inline);
    item.value = replacement;
    return undefined;
  }

  const added = valueTokens(value, indent);
  if (!added) return `\`${field}\` could not be written as YAML.`;

  if (!CST.stringify(block).endsWith("\n")) closeLastLine(block, indent);

  // A field the file has never had. Appended rather than placed by guesswork:
  // where a key belongs among the others is an opinion, and the file's own order
  // is somebody else's.
  block.items.push({
    start: indent > 0 ? [space(indent)] : [],
    key: CST.createScalarToken(field, { indent, implicitKey: true, end: [] }),
    sep: separatorFor([], indent, inline),
    value: added,
  });

  return undefined;
};

/**
 * Take a key out of the file.
 *
 * The whole item goes, which takes its indentation and its trailing newline with
 * it, so the line disappears rather than becoming an empty one. The first item
 * of a map is the exception worth handling: it sits on the same line as the
 * `- ` that opened it, so the one that inherits its place has to lose the indent
 * it was written with.
 */
const remove = (block: CST.BlockMap, pair: Pair<ParsedNode, ParsedNode | null>) => {
  const index = block.items.findIndex((item) => item === pair.srcToken);
  if (index === -1) return;

  const [removed] = block.items.splice(index, 1);
  const opened = removed && !removed.start.some((token) => token.type === "space");

  if (index === 0 && opened) {
    const next = block.items[0];
    if (next) next.start = next.start.filter((token) => token.type !== "space");
  }
};

/** The tree an edit is meant to produce, for checking what it did produce. */
const expected = (before: unknown, edits: readonly DocumentEdit[]) => {
  const tree = structuredClone(before) as Record<string, unknown>;

  for (const edit of edits) {
    let node: Record<string, unknown> | undefined = tree;
    for (const key of edit.keys) {
      node = (node as Record<string, unknown> | undefined)?.[key as string] as
        | Record<string, unknown>
        | undefined;
    }
    if (!node) continue;

    for (const [field, value] of Object.entries(edit.values)) {
      if (value === undefined) delete node[field];
      else node[field] = value;
    }
  }

  return tree;
};

/**
 * The document with the edits in it, or the reasons they could not go in.
 *
 * All or nothing. A config file half saved is worse than one not saved: the
 * organiser is left reading a diff to work out which half, and the half that
 * landed has already been validated as though the other half were there too.
 */
export const editDocument = (
  source: string,
  edits: readonly DocumentEdit[],
): DocumentEditResult => {
  const { tokens, doc } = parseWithSource(source);
  const issues: DocumentIssue[] = [];

  if (!doc || doc.errors.length) {
    return {
      issues: [
        {
          path: "config",
          message: `The config file could not be parsed for editing. ${doc?.errors[0]?.message ?? ""}`,
        },
      ],
    };
  }

  const before = doc.toJS();

  for (const edit of edits) {
    const node = edit.keys.length === 0 ? doc.contents : doc.getIn(edit.keys, true);

    // Present is not enough: it has to be something with fields in it. A
    // competition spliced in by `${{ yaml(...) }}` is a string here, and setting
    // a key on a string throws rather than reporting anything an organiser could
    // act on.
    if (!isCollection(node)) {
      issues.push({ path: edit.path, message: missing(doc, edit) });
      continue;
    }

    const block = node.srcToken;

    if (!block || block.type !== "block-map") {
      issues.push({
        path: edit.path,
        message:
          "This block is written inline in the config file, which this editor cannot " +
          "change without rewriting the line. Edit it by hand.",
      });
      continue;
    }

    for (const [field, value] of Object.entries(edit.values)) {
      const at = [...edit.keys, field];
      const templates = templatesUnder(plainAt(doc, at));

      if (templates.length) {
        issues.push({
          path: edit.path,
          message:
            `\`${field}\` is set from ${templates[0]}, so its value is not kept in the config ` +
            `file. Change it where that value comes from.`,
        });
        continue;
      }

      const pair = pairIn(node, field);

      if (value === undefined) {
        if (pair) remove(block, pair);
        continue;
      }

      const failed = place(block, pair, field, value);
      if (failed) issues.push({ path: edit.path, message: failed });
    }
  }

  if (issues.length) return { issues };

  const edited = render(tokens);

  // What was written has to read back as what was asked for, and everything else
  // has to read back as it was. Both are cheap to check and neither is obvious
  // from looking at the output, which is the kind of mistake that saves cleanly
  // and says something else.
  const { doc: reread } = parseWithSource(edited);

  if (!reread || reread.errors.length || !isEqual(reread.toJS(), expected(before, edits))) {
    return {
      issues: [
        {
          path: "config",
          message:
            "The edited config file did not come back saying what was asked for, so nothing " +
            "was saved. This is a bug in the kit rather than a problem with the values.",
        },
      ],
    };
  }

  return { source: edited, issues: [] };
};
