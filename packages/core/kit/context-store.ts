import { Effect as E } from "effect";
import { isNil } from "es-toolkit";
import type { Namespace } from "../namespace";
import type { SerialisableValue } from "../serialisable";
import { MissingContextError, MissingNamespaceError } from "./errors";
import type { Instance } from "./runtime";

type OptionalNamespace<T, U extends Record<string, any>> = T extends undefined
  ? { namespace: Namespace } & U
  : { namespace?: never } & U;

/**
 * Key/value storage hung off another record, scoped to a namespace.
 *
 * Bound to a namespace up front where the caller always means the same one
 * (`jobs.context`, `outputs`, `secrets.user`), and left open where it does not.
 * The type makes `namespace` required exactly when it was not fixed here.
 */
export const createNamespacedContext =
  (instance: Instance) =>
  <T extends Namespace | undefined = undefined>(ns?: T) => ({
    set: ({
      namespace = ns,
      owner,
      reference,
      value,
    }: OptionalNamespace<T, { owner: string; reference: string; value: SerialisableValue }>) =>
      E.gen(function* () {
        if (!namespace) return yield* E.fail(new MissingNamespaceError());
        const existing = yield* instance.context.list({
          namespace,
          owner,
          reference,
        });

        // More than one row can share a reference, though that is unusual.
        if (!existing.length) {
          const created = yield* instance.context.create({
            namespace,
            owner,
            reference,
            value,
          });
          return { context: [created.id] };
        }

        yield* E.forEach(existing, (entry) => instance.context.update({ id: entry.id, value }));

        return { context: existing.map((entry) => entry.id) };
      }),
    require: ({
      namespace = ns,
      owner,
      reference,
    }: OptionalNamespace<T, { owner: string; reference: string }>) =>
      E.gen(function* () {
        if (!namespace) return yield* E.fail(new MissingNamespaceError());
        const [existing] = yield* instance.context.list({
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
        const [existing] = yield* instance.context.list({
          owner,
          namespace,
          reference,
        });
        return existing?.value as SerialisableValue | undefined;
      }),
  });
