import { Path } from "@effect/platform";
import { Config, Data as D, Effect as E, Either, Match as M } from "effect";
import { isNil, isUndefined, noop, omit } from "lodash-es";
import type { OpenCompetitionKitApi } from "./api";
import { OpenCompetitionKitCollections } from "./collections";
import { OpenCompetitionKitConfig } from "./config";
import { access, type Accessor } from "./config/access";
import {
  describeRefusals,
  verdictOf,
  type Refusal,
} from "./gate";
import { Hooks, OpenCompetitionKitHooks } from "./hook";
import { type schemas, type WithHooks } from "./hook/db";
import {
  keyOf,
  makeKey,
  toFileRef,
  type FileBody,
  type FileRef,
} from "./file";
import type { Namespace } from "./namespace";
import type { SerialisableValue } from "./serialisable";
import { flow } from "./utils/flow";

/**
 * What a sandbox is given when the caller says nothing.
 *
 * These exist because the code being run is a stranger's. A runner that forgets
 * to pass limits gets confined anyway; the only way to widen them is to say so.
 * The wall-clock default is deliberately generous — an evaluation suite is
 * allowed to be slow — while memory and process count are not, because those are
 * how a single submission takes the host down with it.
 */
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_MEMORY_MB = 2048;
const DEFAULT_PIDS = 256;

export type SandboxRequest = {
  image: string;
  command: readonly string[];
  files?: Readonly<Record<string, Uint8Array | string>>;
  env?: Readonly<Record<string, string>>;
  cwd?: string;
  timeoutMs?: number;
  limits?: {
    memoryMb?: number;
    cpus?: number;
    pids?: number;
    network?: boolean;
    writable?: boolean;
  };
};

export class CollectionOwnerError extends D.TaggedError(
  "CollectionOwnerError",
) {}

export class MissingContextError extends D.TaggedError("MissingContextError") {}
export class MissingNamespaceError extends D.TaggedError(
  "MissingNamespaceError",
) {}
export class MissingFileError extends D.TaggedError("MissingFileError")<{
  key: string;
}> {}
export class FileTooLargeError extends D.TaggedError("FileTooLargeError")<{
  key: string;
  size: number;
  limit: number;
}> {}

/**
 * A submission the gate chain refused.
 *
 * Raised in core rather than in the UI's server function so the rules hold for
 * every caller — a package, a script, a future API route — and not only for the
 * one path that happens to render a form. What the rules *are* is not core's
 * business: it runs the chain and reports what came back.
 */
export class SubmissionRefusedError extends D.TaggedError(
  "SubmissionRefusedError",
)<{
  track: string;
  refusals: readonly Refusal[];
}> {
  override get message() {
    return describeRefusals(this.refusals);
  }
}

export function withCollectionUtilities<
  TCreate,
  TUpdate extends { id: string },
  TFull extends { id: string },
  U1,
  E1,
  E2,
  E3,
  C1,
  C2,
  C3,
  U2 = U1,
>(
  table: WithHooks<TCreate, TUpdate, TFull, E1, C1>,
  owner: (item: TFull) => E.Effect<U1, E2, C3>,
  of: (owner: U2) => E.Effect<Readonly<TFull[]>, E3, C2>,
) {
  return {
    ...table,
    on: noop,
    of,
    owner,
    find: (...a: Parameters<typeof table.list>) =>
      table.list(...a).pipe(E.andThen((e) => e[0])),
    upsert: (a: TUpdate & TCreate) =>
      E.gen(function* () {
        const prev = yield* E.either(table.get(a.id));
        if (Either.isRight(prev)) {
          yield* table.update(a);
          return { created: false };
        } else {
          yield* table.create(a);
          return { created: true };
        }
      }),
  };
}

export function withMergeConfig<
  TCreate,
  TUpdate extends { id: string },
  TFull extends { id: string },
  TConfig,
  E1,
  C1,
  E2,
  C2,
>(
  table: WithHooks<TCreate, TUpdate, TFull, E1, C1>,
  getConfig: (id: string) => E.Effect<TConfig, E2, C2>,
) {
  return {
    ...table,
    list: (...a: Parameters<typeof table.list>) =>
      E.gen(function* () {
        const prev = yield* table.list(...a);
        const next = prev.map((b1) =>
          E.gen(function* () {
            return { ...b1, ...(yield* getConfig(b1.id)) };
          }),
        );
        return yield* E.all(next);
      }),
    get: (...a: Parameters<typeof table.get>) =>
      E.gen(function* () {
        const prev = yield* table.get(...a);
        const c = yield* getConfig(prev.id);
        return { ...prev, ...c };
      }),
    create: (...a: Parameters<typeof table.create>) =>
      E.gen(function* () {
        const prev = yield* table.create(...a);
        const c = yield* getConfig(prev.id);
        return { ...prev, ...c };
      }),
  };
}

export class OpenCompetitionKit extends E.Service<OpenCompetitionKit>()(
  "open-competition-kit/OpenCompetitionKit",
  {
    effect: E.gen(function* () {
      const path = yield* Path.Path;
      const configService = yield* OpenCompetitionKitConfig;
      const config = yield* configService.config;
      const hooksService = yield* OpenCompetitionKitHooks;

      const hooks = {
        do: <U>(
          call: (h: Hooks) => Promise<U>,
          ...w: Parameters<typeof hooksService.get>
        ) =>
          E.provideService(
            hooksService.get(...w).pipe(E.andThen(call)),
            Path.Path,
            path,
          ),
      };

      const db = yield* OpenCompetitionKitCollections;
      const instance = yield* db();
      type OptionalNamespace<T, U extends Record<string, any>> =
        T extends undefined ? { namespace: Namespace } & U
        : { namespace?: never } & U;
      const namespacedContext = <T extends Namespace | undefined = undefined>(
        ns?: T,
      ) => ({
        set: ({
          namespace = ns,
          owner,
          reference,
          value,
        }: OptionalNamespace<
          T,
          { owner: string; reference: string; value: SerialisableValue }
        >) =>
          E.gen(function* () {
            if (!namespace) return yield* E.fail(new MissingNamespaceError());
            const existing = yield* context.list({
              namespace,
              owner,
              reference,
            });
            // Edge case there could be many contexts with the same reference,
            // though this is unusual.
            if (!existing.length) {
              const created = yield* instance.context.create({
                namespace,
                owner,
                reference,
                value,
              });
              return { context: [created.id] };
            }

            yield* E.forEach(existing, (entry) =>
              instance.context.update({ id: entry.id, value }),
            );

            return { context: existing.map((entry) => entry.id) };
          }),
        require: ({
          namespace = ns,
          owner,
          reference,
        }: OptionalNamespace<T, { owner: string; reference: string }>) =>
          E.gen(function* () {
            if (!namespace) return yield* E.fail(new MissingNamespaceError());
            const existing = yield* context.find({
              owner,
              namespace,
              reference,
            });
            if (!existing || isNil(existing.value)) {
              return yield* E.fail(new MissingContextError());
            }
            return existing.value as NonNullable<SerialisableValue>;
          }),
        get: ({
          namespace = ns,
          owner,
          reference,
        }: OptionalNamespace<T, { owner: string; reference: string }>) =>
          E.gen(function* () {
            if (!namespace) return yield* E.fail(new MissingNamespaceError());
            const existing = yield* context.find({
              owner,
              namespace,
              reference,
            });
            return existing?.value as SerialisableValue | undefined;
          }),
      });

      // ─── Competition ─────────────────────────────────────

      const competitions = flow(
        instance.competitions,
        (c) => withMergeConfig(c, (id) => access({ competitions: id }, config)),
        (c) =>
          withCollectionUtilities(
            c,
            () => E.fail(new CollectionOwnerError()),
            () => c.list({}),
          ),
      );

      // ─── User ────────────────────────────────────────────

      const users = withCollectionUtilities(
        instance.users,
        () => E.fail(new CollectionOwnerError()),
        () => instance.users.list({}),
      );

      // ─── Track ───────────────────────────────────────────

      const tracks = flow(
        instance.tracks,
        (c) =>
          withMergeConfig(c, (id) =>
            access({ competitions: { tracks: id } }, config),
          ),
        (c) =>
          withCollectionUtilities(
            c,
            (track) => competitions.get(track.competition),
            (competition) => c.list({ competition: competition.id }),
          ),
      );
      // ─── Form ────────────────────────────────────────────

      const forms = {
        get: (id: string) =>
          access({ competitions: { tracks: id } }, config).pipe(
            E.andThen((c) => c.form),
          ),
        load: (track: string, user: string) =>
          E.gen(function* () {
            const def = (yield* access(
              { competitions: { tracks: track } },
              config,
            )).form;
            const loaded = yield* hooks.do(
              (h) => h.form.loader({ def, user }),
              { competitions: { tracks: track } },
            );
            return loaded?.def ?? def;
          }),
      };
      // ─── Leaderboard ─────────────────────────────────────

      const leaderboards = {
        get: (id: string) =>
          access({ competitions: { leaderboards: id } }, config),
        load: (leaderboard: string) =>
          E.gen(function* () {
            const raw = yield* access(
              { competitions: { leaderboards: leaderboard } },
              config,
            );
            // `propagateExtendable` stamps `with` onto every object it walks, so
            // it lands inside `options` too — where it means nothing and would
            // show up to renderers as a phantom setting. Drop it.
            const def =
              raw?.options ?
                { ...raw, options: omit(raw.options, ["with"]) }
              : raw;
            const owner = config.competitions.find((c) =>
              c.leaderboards.some((l) => l.id === leaderboard),
            );
            const loaded = yield* hooks.do(
              (h) =>
                h.leaderboard.loader({ def, competition: owner?.id ?? "" }),
              { competitions: { leaderboards: leaderboard } },
            );
            // Fall back to whatever the config declared rather than blanking the
            // board: a leaderboard with no loader should still render its
            // literal `items`.
            return loaded?.def ?? { ...def, items: def.items ?? [] };
          }),
      };
      // ─── Enrolment ───────────────────────────────────────────────────────────────

      const enrolments = {
        ...withCollectionUtilities(
          instance.enrolments,
          (enrolment) => tracks.get(enrolment.track),
          (owner: typeof schemas.user.Type | typeof schemas.track.Type) =>
            M.value(owner).pipe(
              M.tag("open-competition-kit/db/user", (user) =>
                instance.enrolments.list({ user: user.id }),
              ),
              M.tag("open-competition-kit/db/track", (track) =>
                instance.enrolments.list({ track: track.id }),
              ),
              M.exhaustive,
            ),
        ),
        isEnrolled: (user: string, track: string) =>
          E.gen(function* () {
            const trackDetails = yield* tracks.get(track);
            const es = yield* enrolments.list({
              track,
              competition: trackDetails.competition,
              user,
            });
            return !!es.length;
          }),
        enrol: (user: string, track: string) =>
          hooks.do((h) => h.enrolments.enrol({ user, track }), {
            competitions: { tracks: track },
          }),
      };
      // ─── Submission ──────────────────────────────────────

      const submissions = {
        ...withCollectionUtilities(
          instance.submissions,
          (submission) => tracks.get(submission.track),
          (track) => instance.submissions.list({ track: track.id }),
        ),
        /**
         * Ask the gate chain whether this user may submit, without submitting.
         *
         * Seeded with an empty list: core contributes no refusals of its own, so
         * every rule here comes from a package and can be read off the config
         * that installed it. The submission form asks this before rendering.
         */
        gate: (user: string, track: string) =>
          E.gen(function* () {
            const refusals = yield* hooks.do(
              (h) => h.submissions.gate({ user, track, refusals: [] }),
              { competitions: { tracks: track } },
            );
            return verdictOf(refusals ?? []);
          }),
        /**
         * What every installed gate has to say about a track, refusing or not.
         *
         * Seeded empty for the same reason `gate` is: core contributes nothing of
         * its own, so every report comes from a package the config installed and
         * can be traced back to it.
         *
         * `user` is optional because most of the answer does not depend on who is
         * asking. A track list renders for signed-out readers and still wants to
         * say when each track closes.
         */
        status: (track: string, user?: string) =>
          E.gen(function* () {
            const reports = yield* hooks.do(
              (h) => h.submissions.status({ track, user, reports: [] }),
              { competitions: { tracks: track } },
            );
            return reports ?? [];
          }),
        submit: (user: string, body: string, track: string) =>
          E.gen(function* () {
            // The same question the form asked, asked again where it counts. A
            // caller that never rendered a form is held to the same rules.
            const verdict = yield* submissions.gate(user, track);
            if (!verdict.allowed) {
              return yield* new SubmissionRefusedError({
                track,
                refusals: verdict.refusals,
              });
            }
            return yield* hooks.do(
              (h) => h.submissions.submit({ user, track, body }),
              { competitions: { tracks: track } },
            );
          }),
      };
      // ─── Job ─────────────────────────────────────────────────────────────────────

      const jobs = {
        ...withCollectionUtilities(
          instance.jobs,
          (job) => submissions.get(job.submission),
          (submission) => instance.jobs.list({ submission: submission.id }),
        ),
        context: namespacedContext("open-competition-kit/namespace/job"),
        createFromSubmission: (submission: string) =>
          E.gen(function* () {
            const created = yield* instance.jobs.create({
              submission,
              status: "pending",
            });
            return { jobs: [created.id] };
          }),
        run: (job: string) =>
          E.gen(function* () {
            const c = yield* jobs
              .get(job)
              .pipe(
                E.andThen(jobs.owner),
                E.andThen(submissions.owner),
                E.andThen(tracks.owner),
              );
            yield* hooks.do((h) => h.runner.setup({ job }), {
              competitions: c.id,
            });
            yield* hooks.do((h) => h.runner.run({ job }), {
              competitions: c.id,
            });
            yield* hooks.do((h) => h.runner.teardown({ job }), {
              competitions: c.id,
            });
          }),
      };

      // ─── Context ─────────────────────────────────────────────────────────────────

      const context = {
        ...namespacedContext(),
        ...withCollectionUtilities(
          instance.context,
          (ctx) =>
            M.value(ctx).pipe(
              M.when({ namespace: "open-competition-kit/namespace/job" }, (c) =>
                jobs.get(c.owner),
              ),
              M.when(
                { namespace: "open-competition-kit/namespace/user" },
                (c) => users.get(c.owner),
              ),
              M.when(
                { namespace: "open-competition-kit/namespace/user/secret" },
                (c) => users.get(c.owner),
              ),
              M.when(
                { namespace: "open-competition-kit/namespace/job/output" },
                (c) => jobs.get(c.owner),
              ),
              M.when(
                { namespace: "open-competition-kit/namespace/submission" },
                (c) => submissions.get(c.owner),
              ),
              M.exhaustive,
            ),
          (owner: typeof schemas.user.Type | typeof schemas.job.Type) =>
            M.value(owner).pipe(
              M.tag("open-competition-kit/db/job", () =>
                instance.context.list({
                  owner: owner.id,
                  namespace: "open-competition-kit/namespace/job",
                }),
              ),
              M.tag("open-competition-kit/db/user", () =>
                instance.context.list({
                  owner: owner.id,
                  namespace: "open-competition-kit/namespace/user",
                }),
              ),
              M.exhaustive,
            ),
        ),
      };

      // ─── Output ──────────────────────────────────────────

      const outputs = namespacedContext(
        "open-competition-kit/namespace/job/output",
      );

      // ─── File ────────────────────────────────────────────

      /**
       * Large files.
       *
       * The bytes go to whichever package implements the `files` hooks; this
       * layer owns the parts a backend must not be trusted with — deriving the
       * key, and recording who the file belongs to so it can be found and
       * reclaimed later.
       */
      const maxBytes = () => {
        const limit = (config.largeFiles as { maxBytes?: number } | undefined)
          ?.maxBytes;
        return typeof limit === "number" && limit > 0 ? limit : undefined;
      };

      const files = {
        /**
         * Claim a key for a file that does not exist yet.
         *
         * The key is derived here, never accepted from a caller: a
         * caller-supplied key is a path traversal, or an overwrite of somebody
         * else's submission. The ownership row is written before the bytes are,
         * so an upload that dies midway leaves a reclaimable record rather than
         * an untracked object in the bucket.
         *
         * `url` is a presigned target the browser can PUT to directly. When the
         * backend cannot presign it is undefined, and the caller must proxy the
         * bytes through `put` instead.
         */
        reserve: ({
          owner,
          namespace,
          name,
          contentType,
          expiresIn,
        }: {
          owner: string;
          namespace: Namespace;
          name?: string;
          contentType?: string;
          expiresIn?: number;
        }) =>
          E.gen(function* () {
            const row = yield* instance.files.create({
              key: "",
              namespace,
              owner,
              name: name ?? "",
              size: 0,
              contentType: contentType ?? "",
              checksum: "",
            });

            const key = makeKey({ namespace, owner, id: row.id, name });
            yield* instance.files.update({ id: row.id, key });

            const url = yield* hooks.do((h) =>
              h.files.link({ key, mode: "write", expiresIn }),
            );

            return { key, id: row.id, url };
          }),

        /** Write bytes to a key already claimed by `reserve`. */
        put: ({
          key,
          body,
          contentType,
        }: {
          key: string;
          body: FileBody;
          contentType?: string;
        }) => hooks.do((h) => h.files.write({ key, body, contentType })),

        /**
         * Seal a reserved key and produce the reference to persist.
         *
         * A client that uploaded straight to the bucket says "done"; the server
         * must not take its word for it. This asks the backend what is actually
         * there, and rejects — and deletes — anything absent or over the limit.
         */
        commit: (key: string) =>
          E.gen(function* () {
            const meta = yield* hooks.do((h) => h.files.peek({ key }));
            const [row] = yield* instance.files.list({ key });

            if (!meta) {
              return yield* E.fail(new MissingFileError({ key }));
            }

            const limit = maxBytes();
            if (limit && meta.size > limit) {
              yield* hooks
                .do((h) => h.files.delete({ key }))
                .pipe(E.catchAll(() => E.void));
              if (row) yield* instance.files.delete(row.id);
              return yield* E.fail(
                new FileTooLargeError({ key, size: meta.size, limit }),
              );
            }

            if (row) {
              yield* instance.files.update({
                id: row.id,
                size: meta.size,
                contentType: meta.contentType ?? row.contentType,
                checksum: meta.checksum ?? "",
              });
            }

            return toFileRef({ ...meta, key }, row?.name || undefined);
          }),

        /** Store bytes and return the reference to persist. Server-side path. */
        write: ({
          owner,
          namespace,
          body,
          name,
          contentType,
        }: {
          owner: string;
          namespace: Namespace;
          body: FileBody;
          name?: string;
          contentType?: string;
        }) =>
          E.gen(function* () {
            const { key } = yield* files.reserve({
              owner,
              namespace,
              name,
              contentType,
            });
            yield* files.put({ key, body, contentType });
            return yield* files.commit(key);
          }),

        /** Size / existence / checksum, without pulling the body. */
        peek: (file: FileRef | string) =>
          hooks.do((h) => h.files.peek({ key: keyOf(file) })),

        read: (file: FileRef | string) =>
          hooks.do((h) => h.files.read({ key: keyOf(file) })),

        /** A direct URL, when the backend can presign one. */
        link: (
          file: FileRef | string,
          mode: "read" | "write" = "read",
          expiresIn?: number,
        ) => hooks.do((h) => h.files.link({ key: keyOf(file), mode, expiresIn })),

        delete: (file: FileRef | string) =>
          E.gen(function* () {
            const key = keyOf(file);
            yield* hooks.do((h) => h.files.delete({ key }));
            const rows = yield* instance.files.list({ key });
            yield* E.forEach(rows, (row) => instance.files.delete(row.id));
          }),

        /** Find ownership rows — by key, by owner, by namespace. */
        list: (partial: { key?: string; owner?: string; namespace?: string }) =>
          instance.files.list(partial as never),

        /** Every file belonging to an owner. */
        of: (owner: string) => instance.files.list({ owner }),

        /**
         * Reclaim an owner's files. Without this, deleting a submission leaks its
         * bytes into the backend permanently.
         */
        purge: (owner: string) =>
          E.gen(function* () {
            const rows = yield* instance.files.list({ owner });
            yield* E.forEach(rows, (row) =>
              E.gen(function* () {
                if (row.key) {
                  yield* hooks
                    .do((h) => h.files.delete({ key: row.key }))
                    .pipe(E.catchAll(() => E.void));
                }
                yield* instance.files.delete(row.id);
              }),
            );
            return rows.length;
          }),
      };

      // ─── Secret ──────────────────────────────────────────

      const secrets = {
        global: {
          get: (s: string) =>
            E.gen(function* () {
              return config.secrets && s in config.secrets ?
                  config.secrets[s]
                : yield* Config.string(s);
            }),
          require: (s: string) =>
            E.gen(function* () {
              const c = yield* secrets.global.get(s);
              if (isUndefined(c))
                return yield* E.fail(new MissingContextError());
              return c;
            }),
        },
        user: namespacedContext("open-competition-kit/namespace/user/secret"),
      };

      // ─────────────────────────────────────────────────────

      /**
       * Running untrusted code.
       *
       * A thin pass-through: unlike `files`, there is no state here to protect —
       * no key to derive, no ownership row to write. What this layer does own is
       * the confinement policy, so that a sandbox package cannot quietly ship a
       * weaker default than the one every caller is entitled to assume.
       */
      const sandbox = {
        run: (request: SandboxRequest) =>
          E.gen(function* () {
            const settings = (config.sandbox ?? {}) as {
              timeoutMs?: number;
              memoryMb?: number;
              pids?: number;
            };

            return yield* hooks.do((h) =>
              h.sandbox.run({
                ...request,
                timeoutMs:
                  request.timeoutMs ?? settings.timeoutMs ?? DEFAULT_TIMEOUT_MS,
                limits: {
                  memoryMb: settings.memoryMb ?? DEFAULT_MEMORY_MB,
                  pids: settings.pids ?? DEFAULT_PIDS,
                  ...request.limits,
                },
              }),
            );
          }),
      };

      return {
        secrets,
        config: {
          get: () => config,
          access: <T extends Accessor>(accessor: T) => access(accessor, config),
          /**
           * Every editable node, with the package fields that apply to it.
           *
           * What a config editor renders a form from: labels, descriptions and
           * current values, contributed by whichever packages the organiser
           * installed. Serialisable, so it crosses to the browser; the schemas
           * that produced it do not and stay on this side.
           */
          describe: () => configService.describe,
        },
        competitions,
        tracks,
        forms,
        leaderboards,
        users,
        enrolments,
        submissions,
        jobs,
        context,
        outputs,
        files,
        sandbox,
        hooks,
      } satisfies OpenCompetitionKitApi;
    }),
  },
) {}
