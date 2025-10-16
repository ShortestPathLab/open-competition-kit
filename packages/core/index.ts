import { Effect } from "effect";
import { getConfig } from "./config";
import { OpenCompetitionKit } from "./OpenCompetitionKit";
import { BunContext } from "@effect/platform-bun";

const kit = Effect.gen(function* () {
  const config = yield* getConfig;
  return new OpenCompetitionKit(config);
});

export default await Effect.runPromise(
  kit.pipe(Effect.provide(BunContext.layer))
);
