import type { Static } from "typebox";
import type { Config } from "./config/schema";

export class OpenCompetitionKit {
  constructor(config: Static<typeof Config>) {
    throw new Error("Not implemented");
  }
}
