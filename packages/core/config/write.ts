/**
 * Changing a setting from inside the product.
 *
 * The other half of `describe`. That one hands an editor the fields the
 * installed packages declare and what the config currently has in them; this one
 * takes edited values back, decides whether they would boot, and saves them.
 * Both go through `walkNodes` and the same package declarations, so a value the
 * editor offered is a value the validator will recognise, and a value it rejects
 * here is one the app would have refused at startup.
 *
 * Five things happen in order, and each is allowed to stop the save:
 *
 *  1. Core's own schema over the core fields an edit touches.
 *  2. The installed packages' schemas over the rest, as boot would run them.
 *  3. The value each field started at, against what the file says now, so two
 *     people on the settings page do not silently overwrite each other.
 *  4. The edit placed in the document, which refuses anything that came from an
 *     interpolation or from an included file.
 *  5. The whole edited document loaded again from scratch. Only then is it
 *     written.
 *
 * The last one is the one that matters. Field validation says each value is the
 * right shape; loading the document says the file still starts an application.
 * Nothing is written until it has.
 */
import { FileSystem, Path } from "@effect/platform";
import { Effect as E, Either, ParseResult, Schema as S } from "effect";
import { isEqual, pick } from "es-toolkit";
import { stringify } from "yaml";
import type { SerialisableValue } from "../serialisable";
import { editDocument, type DocumentEdit } from "./document";
import { validateNode, type NodeKind } from "./extension";
import {
  CompetitionConfig,
  Config,
  FormFieldNode,
  FormNode,
  LeaderboardNode,
  TrackNode,
} from "./schema";
import { CORE_KEYS, collectExtensions, type Resolve } from "./validate";
import { walkNodes, type Node } from "./walk";
import { probeWritable, writeConfigFile } from "./writable";

/**
 * Core's own schema at each node kind, by field.
 *
 * `validateNode` waves core's keys through: it is asking whether every field
 * belongs to somebody, and core's belong to core by definition. That leaves the
 * fields core declares unchecked on the way in, which was harmless while nothing
 * could write them and is not now. Held by field rather than as whole schemas so
 * an edit can be checked against exactly the fields it touches, instead of
 * decoding a competition's every track to find out whether its name is a string.
 */
const CORE_SCHEMA_FIELDS: Partial<Record<NodeKind, S.Struct.Fields>> = {
  root: Config.fields,
  competition: CompetitionConfig.fields,
  track: TrackNode.fields,
  form: FormNode.fields,
  formField: FormFieldNode.fields,
  leaderboard: LeaderboardNode.fields,
};

/** New values for one node, named by the path `describe` reported it under. */
export type ConfigEdit = {
  /** Dotted path, e.g. `config.competitions.fit5047.tracks.main`. */
  path: string;
  /**
   * Field id to its new value. `undefined` clears the field, which is how an
   * editor says "unset" rather than "set to nothing": a YAML null is a value a
   * package can read, and an absent key is not.
   */
  values: Record<string, SerialisableValue | undefined>;
  /**
   * What each field held when the editor drew it, for the fields it showed.
   *
   * Optional, and worth sending. The config is a file, so it has other authors:
   * the organiser's colleague on the same page, and the organiser's own text
   * editor. Without this, a save quietly replaces whatever arrived in between
   * with a value that was chosen before it existed.
   *
   * A field the editor was never given a value for, which is every `secret` one,
   * belongs left out rather than sent as nothing.
   */
  expect?: Record<string, SerialisableValue | undefined>;
};

/** One reason the change was refused, against the node that caused it. */
export type ConfigWriteIssue = {
  path: string;
  message: string;
};

export type ConfigWriteResult = {
  /**
   * Whether the change was taken: every value valid, and every one placeable in
   * the config file. False means `issues` says what to fix.
   */
  accepted: boolean;
  issues: ConfigWriteIssue[];
  /** Whether the config file was written. */
  stored: boolean;
  /**
   * Why an accepted change was not saved.
   *
   * A deployment can be perfectly healthy and unable to save: a config file bind
   * mounted read only is a normal way to run this. An editor should say so and
   * offer the lines to paste, rather than report a save that did not happen.
   */
  reason?: string;
  /** The accepted values as YAML, for pasting under the node by hand. */
  yaml?: string;
  /** The file that was written, when one was. */
  file?: string;
};

/**
 * The edit as an organiser would type it.
 *
 * A fragment rather than a whole document, because a whole document is exactly
 * what cannot be produced here: dumping the parsed config back out would drop
 * every comment the organiser wrote, and the comments in a competition config
 * carry most of what makes it readable. A cleared field appears as a note rather
 * than a key, since YAML has no way to spell an absence.
 */
const render = (edits: readonly ConfigEdit[]) =>
  edits
    .map((edit) => {
      const set: Record<string, SerialisableValue> = {};
      const cleared: string[] = [];

      for (const [key, value] of Object.entries(edit.values)) {
        if (value === undefined) cleared.push(key);
        else set[key] = value;
      }

      const body = Object.keys(set).length ? stringify(set, { lineWidth: 80 }).trimEnd() : "";
      const notes = cleared.map((key) => `# delete the "${key}" line`);

      return [`# ${edit.path}`, body, ...notes].filter(Boolean).join("\n");
    })
    .join("\n\n");

/**
 * Run core's own schema over the core fields one edit touches.
 *
 * Only the fields the edit names, picked out of the node's schema. Decoding the
 * whole node would walk a competition's every track and leaderboard to check
 * that its name is a string, and would fail on parts of the config the organiser
 * did not touch and cannot reach from here.
 *
 * A cleared field is left out of what gets decoded rather than passed as
 * nothing, so clearing an optional field is accepted and clearing a required one
 * fails as missing, which is the difference between the two.
 */
const checkCoreFields = (
  kind: NodeKind,
  edit: ConfigEdit,
  proposed: Node,
): E.Effect<string | undefined, never, never> =>
  E.gen(function* () {
    const fields = CORE_SCHEMA_FIELDS[kind];
    if (!fields) return undefined;

    const touched = Object.keys(edit.values).filter((key) => key in fields);
    if (touched.length === 0) return undefined;

    // Core's schemas need nothing from the environment. The cast is the price of
    // building one from picked fields, which erases that down to `unknown`.
    const schema = S.Struct(pick(fields, touched) as S.Struct.Fields) as unknown as S.Schema<
      Node,
      unknown,
      never
    >;
    const subject = Object.fromEntries(
      touched.filter((key) => proposed[key] !== undefined).map((key) => [key, proposed[key]]),
    );

    const decoded = yield* E.either(S.decodeUnknown(schema)(subject));

    if (Either.isLeft(decoded)) {
      // One complaint per field, the way a package's reads. The tree formatter
      // is precise and unreadable: it draws every branch of a union, so a
      // `visibility` that should be one of two words comes back as six lines of
      // box drawing for an organiser to decipher.
      const byField = new Map<string, string[]>();

      for (const issue of ParseResult.ArrayFormatter.formatErrorSync(decoded.left)) {
        const field = issue.path.join(".");
        byField.set(field, [...(byField.get(field) ?? []), issue.message]);
      }

      return [...byField]
        .map(([field, messages]) => {
          // Every optional field fails its `undefined` branch too. Saying so
          // alongside the real reason reads as a second, stranger complaint.
          const real =
            messages.length > 1
              ? messages.filter((message) => !message.includes("Expected undefined"))
              : messages;
          const said = [...new Set(real.length ? real : messages)].join(", or ");
          return field ? `${field}: ${said}` : said;
        })
        .join("; ");
    }

    // Coerced values kept, the same way `validateNode` keeps a package's. A YAML
    // timestamp normalised to an ISO string here is normalised everywhere.
    Object.assign(proposed, decoded.right);
    return undefined;
  });

/** A value as the editor was shown it, so the two can be compared. */
const asShown = (value: unknown) => (value instanceof Date ? value.toISOString() : value);

/**
 * The fields that have moved under the editor's feet.
 *
 * Compared against the tree the file currently parses to, not against the
 * document, because that tree is what the editor was drawn from. Only the fields
 * the caller vouched for are checked: it knows which ones it showed.
 */
const staleIn = (edit: ConfigEdit, node: Node): string[] =>
  Object.entries(edit.expect ?? {}).flatMap(([field, was]) =>
    isEqual(asShown(node[field]), asShown(was)) ? [] : [field],
  );

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Check a set of edits, then save them.
 *
 * Checked on a copy, so a rejected edit leaves the running config exactly as it
 * was. Every edit is checked even after one fails, because an editor showing one
 * complaint at a time makes somebody fix a form field by field.
 */
export const setConfig = <R = never>({
  config,
  edits,
  resolve,
  file,
  check,
}: {
  /** The tree the file currently parses to, which is what the editor was shown. */
  config: Node;
  edits: readonly ConfigEdit[];
  resolve: Resolve<R>;
  /** The config file and the exact text this validation was done against. */
  file: { path: string; source: string };
  /** Whether a candidate document would boot, run the way boot runs it. */
  check: (source: string) => E.Effect<unknown, unknown, never>;
}): E.Effect<ConfigWriteResult, never, R | FileSystem.FileSystem | Path.Path> =>
  E.gen(function* () {
    const copy = structuredClone(config) as Node;
    const nodes = new Map([...walkNodes(copy)].map((walked) => [walked.path, walked]));
    const issues: ConfigWriteIssue[] = [];
    const placements: DocumentEdit[] = [];

    for (const edit of edits) {
      const walked = nodes.get(edit.path);

      if (!walked) {
        issues.push({
          path: edit.path,
          message:
            "No such node in the config. It may have been renamed or removed since " +
            "this page loaded.",
        });
        continue;
      }

      const { node, kind, installed } = walked;
      const stale = staleIn(edit, node);

      if (stale.length) {
        issues.push({
          path: edit.path,
          message:
            `${stale.map((field) => `\`${field}\``).join(", ")} changed in the config file ` +
            `since this page was opened. Reload the page to see what it says now, then make ` +
            `the change again.`,
        });
        continue;
      }

      const proposed: Node = { ...node };

      for (const [key, value] of Object.entries(edit.values)) {
        if (value === undefined) delete proposed[key];
        else proposed[key] = value;
      }

      // Core's fields first, since a name that is not a string should be said
      // so plainly rather than reported by whichever package schema trips over
      // it on the way past.
      const coreIssue = yield* checkCoreFields(kind, edit, proposed);
      if (coreIssue) {
        issues.push({ path: edit.path, message: coreIssue });
        continue;
      }

      const { byKind, unloadable } = yield* collectExtensions(installed, resolve);

      const checked = yield* E.either(
        validateNode(proposed, {
          kind,
          path: edit.path,
          coreKeys: CORE_KEYS[kind],
          extensions: byKind.get(kind) ?? [],
          unloadable,
          strict: true,
        }),
      );

      if (Either.isLeft(checked)) {
        // The sentence without the path in front of it. The caller already knows
        // which node it sent, and repeating it turns one complaint into two.
        issues.push({ path: edit.path, message: checked.left.detail });
        continue;
      }

      // Onto the copy, so a later edit to the same node is checked against what
      // the earlier one left rather than against the config on disk.
      Object.assign(node, checked.right);
      for (const key of Object.keys(edit.values)) {
        if (edit.values[key] === undefined) delete node[key];
      }

      // The values as the editor sent them rather than as validation coerced
      // them. A package schema is free to hand back something richer than what
      // it was given, and the file wants what somebody typed.
      placements.push({ path: edit.path, keys: walked.keys, values: edit.values });
    }

    if (issues.length) return { accepted: false, issues, stored: false };
    if (edits.length === 0) {
      return { accepted: true, issues: [], stored: false, reason: "There was nothing to save." };
    }

    const writability = yield* probeWritable(file.path);

    if (!writability.writable) {
      return {
        accepted: true,
        issues: [],
        stored: false,
        reason: writability.detail,
        yaml: render(edits),
      };
    }

    const edited = editDocument(file.source, placements);

    if (edited.source === undefined) {
      return { accepted: false, issues: edited.issues, stored: false };
    }

    // The whole document, loaded from nothing, the way the next start will load
    // it. Field validation says each value is the right shape; this says the file
    // is still a file the application comes up from.
    const boots = yield* E.either(check(edited.source));

    if (Either.isLeft(boots)) {
      return {
        accepted: false,
        stored: false,
        issues: [
          {
            path: "config",
            message: `Saved as written, the config would not load: ${messageOf(boots.left)}`,
          },
        ],
      };
    }

    const written = yield* E.either(
      writeConfigFile({
        path: file.path,
        previous: file.source,
        next: edited.source,
        strategy: writability.strategy,
      }),
    );

    if (Either.isLeft(written)) {
      return {
        accepted: true,
        issues: [],
        stored: false,
        reason: `${file.path} could not be written. ${messageOf(written.left)}`,
        yaml: render(edits),
      };
    }

    return { accepted: true, issues: [], stored: true, file: file.path };
  });
