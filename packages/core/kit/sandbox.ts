import type { HookRunner } from "./runtime";

/**
 * What a sandbox is given when the caller says nothing.
 *
 * These exist because the code being run is a stranger's. A runner that forgets
 * to pass limits gets confined anyway, and the only way to widen them is to say
 * so. The wall-clock default is deliberately generous, since an evaluation suite
 * is allowed to be slow, while memory and process count are not: those are how a
 * single submission takes the host down with it.
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
  collect?: readonly string[];
  timeoutMs?: number;
  limits?: {
    memoryMb?: number;
    cpus?: number;
    pids?: number;
    network?: boolean;
    writable?: boolean;
  };
};

/**
 * Running untrusted code.
 *
 * A thin pass-through: unlike `files` there is no state to protect, no key to
 * derive and no ownership row to write. What this layer supplies is a floor of
 * confinement for a caller that asked for none.
 *
 * It is a default and not a ceiling, and the difference matters. An organiser's
 * maximum lives in the `sandbox:` block, belongs to whichever package implements
 * these hooks, and is applied there: core can hand a sandbox a number but cannot
 * verify the sandbox used it, so a clamp here would protect against nothing.
 */
export const createSandbox = (hooks: HookRunner) => ({
  /**
   * Make an image exist. Nothing to default and nothing to protect, so this has no
   * floor of its own. The confinement defaults are about the stranger's code that
   * will eventually run; a build recipe came from the organiser's config, and
   * confining it would only stop it installing what it was written to install.
   */
  build: (request: {
    dockerfile: string;
    context?: string;
    args?: Readonly<Record<string, string>>;
    tag?: string;
  }) => hooks.do((h) => h.sandbox.build(request)),

  run: (request: SandboxRequest) =>
    hooks.do((h) =>
      h.sandbox.run({
        ...request,
        timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        limits: {
          memoryMb: DEFAULT_MEMORY_MB,
          pids: DEFAULT_PIDS,
          ...request.limits,
        },
      }),
    ),
});
