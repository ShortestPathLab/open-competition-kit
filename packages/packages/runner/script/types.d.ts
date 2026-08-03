/**
 * The shim is a real Python file, imported as text.
 *
 * It could have been a template literal in a `.ts`, and was not, because the
 * shim is the half of the protocol an organiser debugs when their program
 * misbehaves. Keeping it a `.py` means it can be read with syntax highlighting,
 * checked by a linter, and run against a program directly without any of the kit
 * being involved.
 */
declare module "*.py" {
  const source: string;
  export default source;
}

/**
 * The JavaScript shim is text too, and `allowJs` is off in this package's
 * tsconfig so that it stays that way. Left on, TypeScript resolves `./shim.mjs`
 * to a module it can parse, type-checks it as source, and reports that it has no
 * default export, which is true and beside the point.
 */
declare module "*.mjs" {
  const source: string;
  export default source;
}
