import { FileSystem } from "@effect/platform";
import { Config, Effect } from "effect";
import { load as _load, YAMLException } from "js-yaml";
import { decode } from "./schema";

const load = (s: string) =>
  Effect.try({
    try: () => _load(s),
    catch: (e) => e as YAMLException,
  });

export const getConfig = Config.string("CONFIG")
  .pipe(Config.withDefault("./competition.config.yaml"))
  .pipe(
    Effect.andThen((path) =>
      Effect.gen(function* () {
        return yield* (yield* FileSystem.FileSystem).readFileString(path);
      })
    ),
    Effect.andThen(load),
    Effect.andThen(decode)
  );
