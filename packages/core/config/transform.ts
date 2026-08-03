/**
 * The expression language `competition.config.yaml` is written in.
 *
 * Four operators, each named for the thing it hands back rather than for what it
 * does internally: `env` gives a variable, `text` a file's contents, `dataUrl` a
 * file encoded for an `<img src>`, and `yaml` a parsed document spliced into the
 * tree as a node.
 *
 *     admins:
 *       - ${{ env("ADMIN_EMAIL", "you@example.com") }}
 *     logo: ${{ dataUrl("./assets/logo.svg") }}
 *     overview: ${{ text("./overview.md") }}
 *     competitions:
 *       - ${{ yaml("./competitions/fit5047.yaml") }}
 *
 * `yaml` is the one that is not a string. A template standing alone as the whole
 * value is replaced by whatever it resolved to, of any type, which is what lets a
 * competition live in its own file. A template sharing a string with other text
 * has to resolve to a string, so `yaml` is refused there rather than stringified
 * into something nobody wants.
 *
 * Paths are resolved against the directory of the file the template was written
 * in, not the process working directory, so an included document can refer to its
 * own neighbours.
 */
import { FileSystem, Path } from "@effect/platform";
import { Config as C, Data, Effect as E } from "effect";
import { isPlainObject, isString } from "es-toolkit";
import { load as loadYaml } from "js-yaml";

/**
 * The largest file `dataUrl` will inline.
 *
 * Base64 costs a third on top of the file, and the result is not stored once. It
 * goes into the config an editor is shown, and into every render of every page
 * that draws the image. A logo has no business being anywhere near this figure,
 * and a call that trips it is nearly always pointed at the wrong file.
 */
export const MAX_DATA_URL_BYTES = 256 * 1024;

/** Extensions worth inlining. Anything else is served as opaque bytes. */
const MIME_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".otf": "font/otf",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export class InterpolationError extends Data.TaggedError("InterpolationError")<{
  /** The `${{ ... }}` that could not be resolved, verbatim. */
  template: string;
  /** Dotted path to the value it was written in, e.g. `config.competitions.0.overview`. */
  at: string;
  reason: string;
}> {
  override get message() {
    return `${this.at}: ${this.template} could not be resolved. ${this.reason}`;
  }
}

/** How many arguments each operator takes, as `[min, max]`. */
const ARITY = {
  env: [1, 2],
  text: [1, 1],
  dataUrl: [1, 1],
  yaml: [1, 1],
} as const satisfies Record<string, readonly [number, number]>;

type Operator = keyof typeof ARITY;

const OPERATORS = Object.keys(ARITY) as Operator[];

type Call =
  | { readonly op: "env"; readonly name: string; readonly fallback?: string }
  | { readonly op: "text" | "dataUrl" | "yaml"; readonly file: string };

/**
 * A single or double quoted string, escapes included.
 *
 * Spelled out rather than `[^)]*` so that a path containing a bracket, which
 * `./assets/logo (1).png` is, parses as one argument instead of truncating at
 * the first character that looks like the end of the call.
 */
const QUOTED = String.raw`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'`;

const ARGUMENTS = String.raw`(?:${QUOTED})(?:\s*,\s*(?:${QUOTED}))*`;

const CALL_PATTERN = new RegExp(
  String.raw`\$\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\(\s*(${ARGUMENTS})?\s*\)\s*\}\}`,
  "g",
);

const QUOTED_PATTERN = new RegExp(QUOTED, "g");

const parseArguments = (list: string | undefined) =>
  (list?.match(QUOTED_PATTERN) ?? []).map((argument) =>
    argument.slice(1, -1).replace(/\\(.)/g, "$1"),
  );

const isOperator = (name: string): name is Operator => name in ARITY;

const buildCall = (op: Operator, args: string[]): Call =>
  op === "env" ?
    { op, name: args[0]!, fallback: args[1] }
  : { op, file: args[0]! };

type Interpolation = {
  readonly call: Call;
  /** Where it was first written, for the error message. */
  readonly at: string;
  /**
   * Where it first shares a string with other text, if it ever does, which
   * constrains it to resolving to a string. Named separately from `at` because
   * the same template can stand alone in one place and be embedded in another,
   * and it is the embedded one an error needs to point at.
   */
  embeddedAt: string | undefined;
};

type TreePath = ReadonlyArray<string | number>;

const describePath = (path: TreePath) => ["config", ...path].join(".");

/**
 * Every string in the tree, with the path it was found at.
 *
 * Deliberately not `traverse`: that rebuilds every object it walks, which turns a
 * `Date` from an unquoted YAML timestamp into `{}`. Nothing here needs a copy,
 * and the substitution pass below builds its own.
 */
const forEachString = (
  value: unknown,
  f: (value: string, path: TreePath) => void,
  path: TreePath = [],
): void => {
  if (isString(value)) return f(value, path);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => forEachString(entry, f, [...path, index]));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      forEachString(entry, f, [...path, key]);
    }
  }
};

type Collected = {
  interpolations: Map<string, Interpolation>;
  /** Calls whose name is not an operator, left as written and warned about. */
  unrecognised: Array<{ template: string; at: string }>;
  /** Calls that name an operator but were handed the wrong number of arguments. */
  invalid: InterpolationError[];
};

const collect = (obj: unknown): Collected => {
  const collected: Collected = {
    interpolations: new Map(),
    unrecognised: [],
    invalid: [],
  };

  forEachString(obj, (value, path) => {
    const at = describePath(path);

    for (const match of value.matchAll(CALL_PATTERN)) {
      const [template, name, list] = match;
      if (!template || !name) continue;

      // Standalone means the template is the entire value, so its result can be
      // spliced in whole. Trimmed, because a YAML block scalar carries a newline
      // the author did not type.
      const standalone = value.trim() === template;
      const existing = collected.interpolations.get(template);
      if (existing) {
        if (!standalone) existing.embeddedAt ??= at;
        continue;
      }

      if (!isOperator(name)) {
        // Left alone rather than refused. A competition's `rules:` may well
        // document a GitHub Actions workflow, and `${{ hashFiles("...") }}` in a
        // fenced code block is text an organiser meant to publish, not a typo.
        if (!collected.unrecognised.some((u) => u.template === template)) {
          collected.unrecognised.push({ template, at });
        }
        continue;
      }

      const args = parseArguments(list);
      const [min, max] = ARITY[name];
      if (args.length < min || args.length > max) {
        collected.invalid.push(
          new InterpolationError({
            template,
            at,
            reason:
              min === max ?
                `${name}() takes ${min} argument, and was given ${args.length}.`
              : `${name}() takes ${min} or ${max} arguments, and was given ${args.length}.`,
          }),
        );
        continue;
      }

      collected.interpolations.set(template, {
        call: buildCall(name, args),
        at,
        embeddedAt: standalone ? undefined : at,
      });
    }
  });

  return collected;
};

/**
 * One call, resolved.
 *
 * Fails with a plain sentence rather than an error type. The caller is the only
 * one holding the template and the path the sentence needs to be useful, so it
 * builds the error and this returns the half it knows.
 */
const resolveCall = (
  cwd: string,
  call: Call,
  seen: readonly string[],
): E.Effect<unknown, string, FileSystem.FileSystem | Path.Path> =>
  E.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    if (call.op === "env") {
      const variable = C.string(call.name);
      return yield* (
        call.fallback === undefined ? variable : (
          variable.pipe(C.withDefault(call.fallback))
        )
      ).pipe(
        E.mapError(
          () => `${call.name} is not set and no fallback was given.`,
        ),
      );
    }

    const file = path.resolve(cwd, call.file);
    const read = <A, E2>(effect: E.Effect<A, E2, never>) =>
      effect.pipe(E.mapError(() => `${file} could not be read.`));

    if (call.op === "text") return yield* read(fs.readFileString(file));

    if (call.op === "dataUrl") {
      const bytes = yield* read(fs.readFile(file));
      if (bytes.length > MAX_DATA_URL_BYTES) {
        return yield* E.fail(
          `${file} is ${bytes.length} bytes, over the ${MAX_DATA_URL_BYTES} byte limit for an inlined file.`,
        );
      }
      const mime =
        MIME_TYPES[path.extname(file).toLowerCase()] ??
        "application/octet-stream";
      return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
    }

    if (seen.includes(file)) {
      return yield* E.fail(
        `Circular include: ${[...seen, file].join(" -> ")}.`,
      );
    }

    const source = yield* read(fs.readFileString(file));
    const document = yield* E.try({
      try: () => loadYaml(source) as unknown,
      catch: (error) => `${file} is not valid YAML. ${String(error)}`,
    });

    // The included document is resolved before it is spliced, against its own
    // directory, so its `text("./x.md")` means the file next to it and not the
    // one next to whoever included it.
    return yield* transformIn(path.dirname(file), document, [
      ...seen,
      file,
    ]).pipe(E.mapError((error) => `In ${call.file}: ${error.message}`));
  });

/**
 * The tree, rebuilt with every template replaced.
 *
 * Nothing recurses into a replacement. An included document arrives here already
 * resolved, and walking into it again would test its strings against a map of
 * templates belonging to a different file.
 */
const substitute = (
  value: unknown,
  resolveString: (value: string) => unknown,
): unknown => {
  if (isString(value)) return resolveString(value);
  if (Array.isArray(value)) {
    return value.map((entry) => substitute(entry, resolveString));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        substitute(entry, resolveString),
      ]),
    );
  }
  return value;
};

const transformIn = (
  cwd: string,
  obj: unknown,
  seen: readonly string[],
): E.Effect<unknown, InterpolationError, FileSystem.FileSystem | Path.Path> =>
  E.gen(function* () {
    const { interpolations, unrecognised, invalid } = collect(obj);

    if (invalid[0]) return yield* E.fail(invalid[0]);

    for (const { template, at } of unrecognised) {
      yield* E.logWarning(
        `${at}: ${template} is not one of ${OPERATORS.join(", ")}, and was left as written.`,
      );
    }

    const resolved = yield* E.all(
      Object.fromEntries(
        [...interpolations].map(([template, interpolation]) => [
          template,
          resolveCall(cwd, interpolation.call, seen).pipe(
            E.mapError(
              (reason) =>
                new InterpolationError({
                  template,
                  at: interpolation.at,
                  reason,
                }),
            ),
          ),
        ]),
      ),
    );

    for (const [template, interpolation] of interpolations) {
      const value = resolved[template];
      if (interpolation.embeddedAt !== undefined && !isString(value)) {
        return yield* E.fail(
          new InterpolationError({
            template,
            at: interpolation.embeddedAt,
            reason: `It resolved to ${Array.isArray(value) ? "a list" : typeof value}, which cannot sit inside a longer string. Give it the whole value.`,
          }),
        );
      }
    }

    return substitute(obj, (value) => {
      const matches = [...value.matchAll(CALL_PATTERN)];
      const only = matches[0]?.[0];
      if (only && matches.length === 1 && value.trim() === only && only in resolved) {
        return resolved[only];
      }
      return value.replaceAll(CALL_PATTERN, (template) =>
        template in resolved ? String(resolved[template]) : template,
      );
    });
  });

/**
 * Resolved config, of no particular shape.
 *
 * `unknown` in and `unknown` out because `yaml` does not preserve one: a string
 * in the input can be a whole competition in the output. `decode` runs straight
 * after this and is where the shape is established.
 */
export const transform = (cwd: string, obj: unknown) =>
  transformIn(cwd, obj, []);
