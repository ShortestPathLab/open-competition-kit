/**
 * Whether a hook composes with the packages beneath it, or replaces them.
 *
 * Most hooks compose. The chain hands a later package the earlier one as `next`,
 * and the implementation decides whether to call it.
 *
 * A `componentSource` cannot work that way, and `surface.view` in `./index`
 * already says why: the function takes no arguments, so a `next` passed to it
 * lands in a parameter nothing reads, and the last package listed takes the whole
 * region. That has always been the behaviour, arrived at by accident. Declaring
 * it stops the chain building a `next` whose only purpose is to be discarded,
 * which is a waste now and a problem later, when a `next` is a value some loader
 * has to carry across a process boundary.
 */
import { Schema as S, SchemaAST as AST } from "effect";

export type HookMode =
  /** Receives `next`. The last package listed is outermost. */
  | "chained"
  /** Receives nothing. The last package listed wins outright. */
  | "override";

/**
 * Symbol-keyed, so it sits alongside Effect's own annotations instead of
 * competing with them for a string key.
 */
export const HookModeAnnotation = Symbol.for("open-competition-kit/hook/mode");

export const withMode = <A, I, R>(schema: S.Schema<A, I, R>, mode: HookMode): S.Schema<A, I, R> =>
  schema.annotations({ [HookModeAnnotation]: mode });

/**
 * A leaf that says nothing is chained, which is what `hook()` produces and what a
 * new hook should be unless somebody has a reason for it not to be.
 */
export const modeOf = (schema: unknown): HookMode => {
  // An Effect schema is callable, so it is a `function` and not an `object`.
  // Checking only for the latter silently reports every hook as chained, which is
  // the right answer often enough to hide the mistake.
  if (
    schema === null ||
    (typeof schema !== "object" && typeof schema !== "function") ||
    !("ast" in schema)
  ) {
    return "chained";
  }
  const ast = (schema as { ast: AST.Annotated }).ast;
  return ast.annotations[HookModeAnnotation] === "override" ? "override" : "chained";
};
