import { Data as D } from "effect";
import { describeRefusals, type Refusal } from "../gate";

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
 * every caller (a package, a script, a future API route) and not only for the one
 * path that happens to render a form. What the rules are is not core's business:
 * it runs the chain and reports what came back.
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
