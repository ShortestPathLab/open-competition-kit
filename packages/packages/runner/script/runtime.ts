/**
 * The languages this package can meet halfway.
 *
 * A runtime is a shim plus the command that runs it. The shim's whole job is to
 * turn the file protocol into whatever "a function" means in its language, so
 * that an organiser writes three plain functions and never opens a file. Adding
 * a language is a shim and a line in this table.
 *
 * Nothing else in the package knows any language exists. `command:` skips this
 * table entirely and speaks the protocol directly, which is what a compiled
 * binary, a shell script, or a language nobody has written a shim for does.
 */
import { PROGRAM, SHIM } from "./protocol";
import node from "./shim.mjs" with { type: "text" };
import python from "./shim.py" with { type: "text" };

export type Runtime = {
  /** The shim, as text. Injected at `SHIM` with the extension below. */
  source: string;
  /**
   * The file extension the shim has to keep.
   *
   * Not decoration: Node decides between modules and scripts by extension, and
   * an interpreter handed a file it cannot name usually says something about
   * syntax rather than about the name.
   */
  extension: string;
  /** How to run it. */
  command: (shim: string) => readonly string[];
  /**
   * The extension the organiser's own program keeps, if it needs one.
   *
   * Node cannot `require` or `import` a path with no extension, so a program
   * that Node has to load is written out as `program.js`. Python's loader is
   * handed an explicit path and does not care.
   */
  programExtension: string;
};

export const RUNTIMES = {
  python: {
    source: python,
    extension: ".py",
    command: (shim) => ["python3", shim],
    programExtension: ".py",
  },
  node: {
    source: node,
    extension: ".mjs",
    command: (shim) => ["node", shim],
    programExtension: ".mjs",
  },
} as const satisfies Record<string, Runtime>;

export type RuntimeName = keyof typeof RUNTIMES;

export const RUNTIME_NAMES = Object.keys(RUNTIMES) as RuntimeName[];

/** Where a runtime's shim and program land, given the runtime. */
export const pathsFor = (name: RuntimeName) => {
  const runtime = RUNTIMES[name];
  return {
    shim: `${SHIM}${runtime.extension}`,
    program: `${PROGRAM}${runtime.programExtension}`,
  };
};
