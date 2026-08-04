import { Schema as S } from "effect";
import { hook } from "./hook";

/**
 * Running untrusted code. Infrastructure like `db` and `files`: it needs a real
 * machine, so it cannot cross a language boundary. A runner describes what to run
 * and how tightly to confine it; the package decides how.
 *
 * The defaults deny: no network, a memory cap, a process cap, a read-only root and
 * a wall-clock limit. A caller must opt back out, because the code being run was
 * written by someone the organiser has never met.
 */
export const sandbox = S.Struct({
  /**
   * Make an image exist, from a recipe the organiser wrote.
   *
   * Inputs come from the config and nowhere else. Job context and submitted bytes
   * never reach this hook, which is what stops a participant choosing the image
   * their own code is judged in. A build has network access by definition, so the
   * protection here is the provenance of the inputs, not confinement.
   *
   * Should be idempotent and cheap on the second call: the caller asks on every
   * startup, and may ask again per job.
   */
  build: hook<
    {
      /** The recipe itself, not a path. Inlined from the config. */
      dockerfile: string;
      /**
       * A directory the recipe may copy from, on the host running the build.
       * Absent means an empty context, which is the common case.
       */
      context?: string;
      /** Build arguments, e.g. a pinned ref for whatever gets cloned. */
      args?: Readonly<Record<string, string>>;
      /**
       * What to call the result. Advisory: an implementation may derive its own
       * tag, and the one it returns is the one to run.
       */
      tag?: string;
    },
    {
      /** The image to pass to `run`. */
      image: string;
      /** False when the image already existed and nothing was built. */
      built: boolean;
      /** The build log, for an organiser working out why a recipe failed. */
      log: string;
    }
  >(),
  run: hook<
    {
      /**
       * The image, already built. Either one the host has or whatever `build`
       * handed back. Nothing is built here: by the time a submission is in the
       * room, the image it runs in is settled.
       */
      image: string;
      command: readonly string[];
      /**
       * Files to place inside before it starts, keyed by absolute path. This is how
       * a submission gets in: the image owns the harness, and these overlay only
       * what the submission is allowed to change.
       */
      files?: Readonly<Record<string, Uint8Array | string>>;
      env?: Readonly<Record<string, string>>;
      /** Where `command` runs. Defaults to the image's WORKDIR. */
      cwd?: string;
      /**
       * Files to take back out once it has finished, by absolute path. A container
       * is destroyed after a run, so anything it produced is gone unless it was
       * asked for. A path that does not exist is absent from the result rather than
       * an error: a run that failed to produce its output has already failed, and
       * the caller has better words for that.
       */
      collect?: readonly string[];
      /** Wall-clock limit. The sandbox is killed, not asked, when it passes. */
      timeoutMs?: number;
      limits?: {
        memoryMb?: number;
        cpus?: number;
        /** Process cap. Without one, `:(){ :|:& };:` takes the host down. */
        pids?: number;
        /** Off unless asked for. */
        network?: boolean;
        /** Writable root. Off unless asked for. */
        writable?: boolean;
      };
    },
    {
      stdout: string;
      stderr: string;
      code: number;
      /** True when the wall-clock limit killed it, which `code` alone cannot say. */
      timedOut: boolean;
      elapsedMs: number;
      /** Whatever `collect` asked for and the run actually produced. */
      files: Readonly<Record<string, Uint8Array>>;
    }
  >(),
});
