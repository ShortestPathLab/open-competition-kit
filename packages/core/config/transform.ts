import { FileSystem, Path } from "@effect/platform";
import { Config as C, Data, Effect as E } from "effect";
import { isString } from "es-toolkit";
import { traverse } from "../utils/traverse";

export class InterpolationError extends Data.TaggedError("InterpolationError")<{
  template: string;
}> {}

type InterpolationCall = {
  kind: "env" | "include";
  value: string;
};

const interpolationPattern =
  /\$\{\{\s*(env|include)\(\s*(["'])(.*?)\2\s*\)\s*\}\}/g;

const collectInterpolations = <T>(obj: T) => {
  const interpolations = new Map<string, InterpolationCall>();

  traverse(obj, (value) => {
    if (!isString(value)) return value;

    for (const match of value.matchAll(interpolationPattern)) {
      const [template, kind, , interpolationValue] = match;
      if (!template || !kind || interpolationValue === undefined) continue;
      interpolations.set(template, {
        kind: kind as InterpolationCall["kind"],
        value: interpolationValue,
      });
    }

    return value;
  });

  return interpolations;
};

const resolveInterpolation = (cwd: string, call: InterpolationCall) =>
  E.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    if (call.kind === "env") return yield* C.string(call.value);

    return yield* fs.readFileString(path.resolve(cwd, call.value));
  });

export const transform = <T>(cwd: string, obj: T) =>
  E.gen(function* () {
    const interpolations = collectInterpolations(obj);
    const resolved = yield* E.all(
      Object.fromEntries(
        [...interpolations].map(([template, call]) => [
          template,
          resolveInterpolation(cwd, call).pipe(
            E.mapError(() => new InterpolationError({ template })),
          ),
        ]),
      ),
    );

    return traverse(obj, (value) => {
      if (!isString(value)) return value;
      return value.replaceAll(interpolationPattern, (template) => {
        return resolved[template] ?? template;
      });
    });
  });
