/**
 * The `machine:` block, as this package reads it.
 *
 * An organiser's ceiling rather than a runner's preference: a runner may ask for
 * less than this but never for more. Declared here because this is the package
 * that applies it. Core can pass a number to a machine but has no way to check
 * that Docker was told about it, so a limit held anywhere but inside the thing
 * doing the confining is a limit that only the confining thing can honour.
 *
 * It is also why every field below is declared by *this* package and not by
 * core: install a machine that cannot cap memory and `memoryMb:` stops being a
 * setting that quietly does nothing and starts being a config the app refuses to
 * boot with.
 *
 * Every field is optional, and an absent one is no ceiling at all rather than a
 * ceiling of zero. A host that configures nothing behaves as it did before this
 * existed: the caller's request stands, on top of the floor core supplies for
 * whatever the caller left out.
 */
import type { ConfigExtensions } from "@open-competition-kit/sdk";
import { z } from "zod";

export const machine = z.object({
  /** Longest wall-clock run, in milliseconds. */
  timeoutMs: z.number().positive().optional(),
  /** Most memory one container may have, in megabytes. */
  memoryMb: z.number().positive().optional(),
  /** Most CPU one container may have, as a share: `0.5` is half a core. */
  cpus: z.number().positive().optional(),
  /** Most processes one container may spawn. */
  pids: z.int().positive().optional(),
  /**
   * Whether a runner may ask for network access at all.
   *
   * `false` forbids it outright, which is the setting worth having: without it a
   * runner opts itself back onto the network with one boolean and the rest of
   * this block is decoration.
   */
  network: z.boolean().optional(),
  /** Whether a runner may ask for a writable root filesystem. */
  writable: z.boolean().optional(),
});

export type MachineCeiling = z.infer<typeof machine>;

export const config = {
  machine: {
    schema: machine,
    group: { id: "machine", label: "Machine ceiling" },
    shape: [
      {
        id: "timeoutMs",
        label: "Wall-clock limit",
        kind: "number",
        description:
          "Longest a single run may take, in milliseconds. The container is killed rather than asked when it passes.",
      },
      {
        id: "memoryMb",
        label: "Memory limit",
        kind: "number",
        description:
          "Megabytes per container. Swap is pinned to the same figure, so a capped container dies instead of swapping the host's disk away.",
      },
      {
        id: "cpus",
        label: "CPU limit",
        kind: "number",
        description: "CPU share per container, where 1 is one core and 0.5 is half of one.",
      },
      {
        id: "pids",
        label: "Process limit",
        kind: "number",
        description:
          "Most processes a container may spawn. Without one, a fork bomb in a submission takes the host down.",
      },
      {
        id: "network",
        label: "Allow network",
        kind: "boolean",
        description:
          "Off forbids network access even to a runner that asks for it. Network is already off unless a runner opts in; this is what stops it opting in.",
      },
      {
        id: "writable",
        label: "Allow writable root",
        kind: "boolean",
        description:
          "Off forbids a writable root filesystem even to a runner that asks for it. A run that injects files gets a writable root regardless, since Docker cannot do both.",
      },
    ],
  },
} satisfies ConfigExtensions;
