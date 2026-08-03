/**
 * The `runner:` block, as this package reads it.
 *
 * Everything a competition needs to be evaluated by a program instead of by a
 * package: the recipe for the image, the program itself, which files a
 * submission may supply, and whatever the program wants to be told.
 *
 * `standard` also declares fields on this node, and the two do not collide: it
 * claims `body` and this claims everything below. A config that sets both is an
 * organiser who has installed two runners, and the one listed later in `with:`
 * wins, silently. Worth knowing rather than worth preventing, since core has no
 * way to tell an intentional override from an accident.
 */
import type { ConfigExtensions } from "@open-competition-kit/sdk";
import { z } from "zod";

/**
 * The config with `with:` taken back out of it.
 *
 * `propagateExtendable` stamps the installed package list onto every object it
 * walks on its way down, so by the time a runner block is read back at runtime
 * there is a `with` inside `include`, inside `params`, inside `limits` and
 * inside `build.args`. Harmless where a package ignores it and not harmless
 * here: it would be a file called `with` copied into every container, a
 * parameter no program asked for, and a `--build-arg` that changes the image's
 * name.
 *
 * Boot-time validation never sees this, since it runs before the walk. Only the
 * runtime read does, which is exactly the kind of difference that gets found in
 * production. Stripping unconditionally means one code path rather than two.
 *
 * Copies rather than deletes: the config object is shared and cached, and a
 * package that edits it edits it for everybody.
 */
const prune = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(prune);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "with")
      .map(([key, entry]) => [key, prune(entry)]),
  );
};

/**
 * A recipe for the evaluation image.
 *
 * The Dockerfile is inlined rather than named by path, so that the competition
 * config carries everything needed to build it and nothing has to be mounted
 * into the runner. `${{ text("./evaluate.dockerfile") }}` is how it gets there.
 *
 * `context` is the exception, and is a path on the machine running the build: a
 * recipe that copies a dataset in needs the dataset to exist somewhere, and no
 * amount of inlining changes that.
 */
export const build = z.object({
  dockerfile: z.string().min(1),
  context: z.string().optional(),
  args: z.record(z.string(), z.string()).optional(),
});

export const limits = z.object({
  memoryMb: z.number().positive().optional(),
  cpus: z.number().positive().optional(),
  pids: z.int().positive().optional(),
  /**
   * Whether the program may reach the network.
   *
   * Off by default and worth leaving off. A program that can fetch is a program
   * a submission can use to fetch, since the two share a container while a case
   * is being evaluated.
   */
  network: z.boolean().optional(),
});

const shape = z
  .object({
    /**
     * The image every phase runs in.
     *
     * Either a tag the host already has, or the one `build` produces. When both
     * are given, `build` wins and this is ignored: an organiser who wrote a
     * recipe meant the recipe.
     */
    image: z.string().min(1).optional(),
    build: build.optional(),
    /**
     * What to run, once per phase.
     *
     * The whole of how a program is started, and the reason this package knows
     * no language: it runs a command and the command reads a file. A Python
     * script, a Go binary and a shell script are the same thing from here.
     *
     * Run from the work directory, so `["python3", "evaluate.py"]` finds the
     * file `include:` placed under that name.
     */
    command: z.array(z.string().min(1)).min(1).optional(),
    /**
     * The files the command needs, keyed by the relative path they land at.
     *
     * Where the evaluation program itself goes, along with anything it reads.
     * There is no separate key for the program because there is nothing special
     * about it any more: nothing loads it, nothing imports it, and only the
     * command decides which of these files is the one that runs.
     *
     * Opaque. This package copies bytes and never looks inside them, which is
     * the point: a competition's list of instances, its reference solutions and
     * its scoring tables are the program's business, and a `cases:` key here
     * would be this package inventing a vocabulary for something it does not
     * understand.
     *
     * Readable by a submission during `evaluate`, since that phase shares a
     * container with it. Anything that must stay secret does not belong here.
     */
    include: z.record(z.string(), z.string()).optional(),
    /**
     * Whatever the program wants to be told, passed to every phase untouched.
     *
     * Where `FIT5047_QUESTIONS` and its kind belong. An environment variable set
     * in a compose file is a competition rule living outside the competition
     * config, where it is not versioned with the thing it governs and not
     * visible to anybody reading it.
     */
    params: z.record(z.string(), z.unknown()).optional(),
    /**
     * Paths a submission may supply, as literals or globs.
     *
     * Absent means the whole archive, which is right when the submission *is*
     * the answer and wrong when it overlays a harness. In the second case this
     * is the only thing standing between a competitor and an edited marking
     * script, so write it.
     */
    submission: z
      .object({ allow: z.array(z.string()).optional() })
      .optional(),
    /** Wall-clock limit for one phase, not for the whole evaluation. */
    timeoutMs: z.number().positive().optional(),
    limits: limits.optional(),
  })
  // A command with no image has nowhere to run, and an image with no command has
  // nothing to run. Either alone is a half-written runner, and finding out at
  // boot beats finding out when the first submission arrives.
  .refine((c) => !c.command || c.image || c.build, {
    message: "a command needs either an image: or a build: to run in",
    path: ["image"],
  })
  .refine((c) => !(c.image || c.build) || c.command, {
    message: "an image with no command: has nothing to run",
    path: ["command"],
  })
  // The command runs from the work directory, and `include:` is the only thing
  // that puts anything there. A command with nothing to run is nearly always a
  // program somebody meant to include and did not.
  .refine((c) => !c.command || Object.keys(c.include ?? {}).length > 0, {
    message:
      "there is nothing for this command to run. The evaluation program goes in " +
      'include:, e.g. `include: { evaluate.py: ${{ text("./evaluate.py") }} }`',
    path: ["include"],
  });

export const script = z.preprocess(prune, shape);

export type ScriptRunner = z.infer<typeof shape>;

export const config = {
  runner: {
    // The pruning wrapper, not the bare shape. Boot-time validation does not
    // need it, since it runs before the propagation walk, but a package that
    // declares two schemas for the same fields is a package with two ideas about
    // what is valid, and one of them will drift.
    schema: script,
    group: { id: "script", label: "Evaluation program" },
    shape: [
      {
        id: "command",
        label: "Command",
        kind: "object",
        description:
          "What to run, once per phase, from the work directory. It reads the request file the kit writes and writes the reply file the kit reads back. Any language: the protocol is two JSON files.",
      },
      {
        id: "image",
        label: "Image",
        kind: "text",
        description:
          "The image every phase runs in. Ignored when a build recipe is given.",
      },
      {
        id: "build",
        label: "Image recipe",
        kind: "object",
        description:
          "A Dockerfile to build the evaluation image from, with optional build arguments. Built when the runner service starts, and named after its contents so an edited recipe rebuilds.",
      },
      {
        id: "include",
        label: "Files",
        kind: "object",
        description:
          "The evaluation program and anything it reads, keyed by the relative path each lands at. Copied without being read. Visible to a submission while a case is being evaluated.",
      },
      {
        id: "params",
        label: "Parameters",
        kind: "object",
        description:
          "Passed to every phase of the program untouched. Where competition settings belong, rather than in environment variables outside the config.",
      },
      {
        id: "submission",
        label: "Permitted files",
        kind: "object",
        description:
          "Paths a submission may supply, as literals or globs. Everything else in the archive is discarded. Absent means take all of it.",
      },
      {
        id: "timeoutMs",
        label: "Phase limit",
        kind: "number",
        description:
          "Wall-clock limit for one phase. A hundred cases each get this much, so it bounds a single case rather than the evaluation.",
      },
      {
        id: "limits",
        label: "Resource limits",
        kind: "object",
        description:
          "Memory, CPU and process caps for one phase, plus whether it may reach the network. Held to the sandbox ceiling on top of this.",
      },
    ],
  },
} satisfies ConfigExtensions;
