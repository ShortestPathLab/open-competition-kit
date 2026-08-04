import { config as kit, unsafe, type Package } from "@open-competition-kit/sdk";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ensure, type BuildRequest } from "./build";
import { config, machine, type MachineCeiling } from "./config";
import { clamp, type Confinement } from "./limits";

/**
 * A machine that runs each command in a Docker container.
 *
 * The one to install when the code being run belongs to somebody the organiser
 * has never met, which is every competition with competitors in it. The local
 * machine in `standard` will start the same command with none of this, and is
 * meant for the afternoon before there are any competitors.
 *
 * Requires a Docker daemon the host can reach — `docker` on PATH, and a socket
 * this process may talk to. In a container that means mounting
 * /var/run/docker.sock and having the CLI installed; the containers it starts
 * are then siblings, not children.
 *
 * ## Why create/cp/start rather than `docker run -v`
 *
 * A bind mount is resolved by the *daemon*, so the path must exist on the host.
 * When this package itself runs inside a container, its paths are its own: a
 * `-v /tmp/job-1:/code` mounts an empty directory and the job fails with
 * something that reads like the submission's fault. Copying the files in is a
 * little slower and always correct, whoever is running it.
 *
 * ## The organiser's ceiling
 *
 * The `machine:` block in the config is declared by this package and applied
 * here, in `limits.ts`. It belongs with the code that talks to the daemon, since
 * that is the only place a limit turns into something the kernel enforces: a
 * ceiling held anywhere else would be one that only this package could choose to
 * honour.
 */

const DOCKER = "docker";

// The confinement half comes from `limits.ts` rather than being written out
// again here, so a limit this package learns to apply cannot be one the clamp
// has never heard of.
type Run = Confinement & {
  image: string;
  command: readonly string[];
  files?: Readonly<Record<string, Uint8Array | string>>;
  env?: Readonly<Record<string, string>>;
  cwd?: string;
  collect?: readonly string[];
};

/**
 * The same, before we have checked there is an image to run in.
 *
 * The hook makes `image` optional because a machine that starts a process on the
 * host has nowhere to put one. This one has nothing to start without it, and the
 * refusal below is the whole reason the field is optional rather than a hopeful
 * empty string: the error can name what to add, which "" cannot.
 */
type Requested = Omit<Run, "image"> & { image?: string };

/**
 * Docker, with no wall-clock limit.
 *
 * A build has no business being timed out by the same figure that stops a
 * runaway submission: installing a toolchain legitimately takes minutes, and the
 * `machine:` ceiling is written with a single evaluation in mind. A recipe that
 * hangs forever is an organiser's mistake and shows up as a service that will
 * not finish starting, which is where it belongs.
 */
const sh = async (args: string[], timeoutMs?: number) => {
  const proc = Bun.spawn([DOCKER, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    ...(timeoutMs ? { timeout: timeoutMs, killSignal: "SIGKILL" as const } : {}),
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { stdout, stderr, code: await proc.exited };
};

/**
 * The confinement flags.
 *
 * Everything is denied unless asked for. `--network none` above all: a
 * submission with a network is a submission that can fetch its answers, exfil
 * the test cases, or attack whatever else is reachable.
 */
const isolation = (limits: Run["limits"], injecting: boolean) => {
  const flags = ["--cap-drop=ALL", "--security-opt=no-new-privileges"];
  if (!limits?.network) flags.push("--network", "none");
  // `docker cp` writes through the rootfs, and the daemon refuses that on a
  // --read-only container even before it starts — the tmpfs below is not mounted
  // until then, so there is nowhere writable to land. Injecting files and a
  // read-only root are mutually exclusive in Docker, so a caller passing `files`
  // gets a writable one. Not the loss it sounds like: the container is
  // disposable, unreachable and unprivileged, so all a submission can vandalise
  // is the copy of the harness it is about to be deleted along with. It is the
  // same trade the original contest server made.
  const readOnly = !limits?.writable && !injecting;
  if (readOnly) flags.push("--read-only");
  // A read-only root with nowhere to write breaks anything that touches a temp
  // file, so give it one that dies with the container.
  if (readOnly) flags.push("--tmpfs", "/tmp:rw,exec,size=256m");
  if (limits?.memoryMb) flags.push("--memory", `${limits.memoryMb}m`);
  // Swap == memory disables swap. Without this a memory-capped container swaps
  // instead of dying, and takes the host's disk down with it.
  if (limits?.memoryMb) flags.push("--memory-swap", `${limits.memoryMb}m`);
  if (limits?.cpus) flags.push("--cpus", String(limits.cpus));
  if (limits?.pids) flags.push("--pids-limit", String(limits.pids));
  return flags;
};

/**
 * Take the requested files back out, before the container is destroyed.
 *
 * Copied to a host path rather than read off `docker cp`'s tar stream, because
 * `docker cp <id>:<path> <dir>` unpacks for us and the alternative is carrying a
 * tar reader to fetch one small JSON file.
 *
 * Named by index on the way out. The container's paths are the container's, and
 * joining one onto a host directory is how `..` in a path somebody else chose
 * ends up writing outside it.
 *
 * A path that is not there is left out of the result. A run that did not produce
 * its output has already gone wrong, and the caller knows what that means for
 * its own protocol far better than this does.
 */
const collectFrom = async (
  id: string,
  paths: readonly string[],
): Promise<Record<string, Uint8Array>> => {
  const out: Record<string, Uint8Array> = {};
  if (!paths.length) return out;

  const staging = await mkdtemp(join(tmpdir(), "ock-collect-"));
  try {
    for (const [index, path] of paths.entries()) {
      const local = join(staging, String(index));
      const copied = await sh(["cp", `${id}:${path}`, local]);
      if (copied.code !== 0) continue;
      const file = Bun.file(local);
      if (!(await file.exists())) continue;
      out[path] = new Uint8Array(await file.arrayBuffer());
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return out;
};

const run = async ({
  image,
  command,
  files,
  env,
  cwd,
  collect,
  timeoutMs,
  limits,
}: Run) => {
  const started = Date.now();

  const injecting = !!files && Object.keys(files).length > 0;

  const created = await sh([
    "create",
    ...isolation(limits, injecting),
    ...(cwd ? ["--workdir", cwd] : []),
    ...Object.entries(env ?? {}).flatMap(([k, v]) => ["--env", `${k}=${v}`]),
    image,
    ...command,
  ]);
  if (created.code !== 0) {
    throw new Error(
      `Could not create a container from "${image}": ${created.stderr.trim()}`,
    );
  }
  const id = created.stdout.trim();

  // A staging directory, because `docker cp` copies paths and we were handed
  // bytes.
  let staging: string | undefined;
  try {
    if (files && Object.keys(files).length) {
      staging = await mkdtemp(join(tmpdir(), "ock-machine-"));
      for (const [path, body] of Object.entries(files)) {
        const local = join(staging, path.replace(/^\/+/, ""));
        await mkdir(dirname(local), { recursive: true });
        await writeFile(local, body as Uint8Array | string);
      }

      // One file at a time where the destination directory already exists, and
      // the whole subtree only where it does not.
      //
      // Both halves are needed and neither is safe alone. `docker cp` refuses a
      // destination whose parent is missing, so file-at-a-time injection only
      // ever worked for paths the image already had; but copying a directory
      // *replaces* the mode and owner of a destination directory that does
      // exist, and the container runs with `--cap-drop=ALL`, which takes away
      // root's power to ignore that. Copy `/tmp/x` as part of a tree and /tmp
      // stops being world-writable. Copy `/runner/agents/x.py` that way and an
      // image with a `USER` of its own can no longer write to its own harness.
      //
      // So: try the file, and let the failure say which parents are missing.
      const missing = new Set<string>();
      for (const path of Object.keys(files)) {
        const relative = path.replace(/^\/+/, "");
        const copied = await sh([
          "cp",
          join(staging, relative),
          `${id}:${path}`,
        ]);
        if (copied.code === 0) continue;

        // The first segment, because that is the largest thing we can create
        // without touching anything the image already put there.
        const root = relative.split("/")[0];
        if (!root || root === relative) {
          throw new Error(
            `Could not place "${path}" into the container: ${copied.stderr.trim()}`,
          );
        }
        missing.add(root);
      }

      // Copied by name rather than with a trailing `/.`, so each one lands as a
      // new directory under `/` instead of merging its contents into a `/` whose
      // permissions we would then have rewritten.
      for (const root of missing) {
        const copied = await sh(["cp", join(staging, root), `${id}:/`]);
        if (copied.code !== 0) {
          throw new Error(
            `Could not create "/${root}" in the container: ${copied.stderr.trim()}`,
          );
        }
      }
    }

    // `start -a` attaches, so this resolves when the command does. The timeout
    // kills the *client*, which is why the container is force-removed below
    // rather than trusted to have stopped.
    const finished = await sh(["start", "-a", id], timeoutMs);

    // 137 is 128+SIGKILL: the wall-clock kill and the OOM killer both produce it,
    // so it alone cannot say which happened. Ask the daemon instead.
    let timedOut = false;
    if (finished.code !== 0) {
      const state = await sh([
        "inspect",
        "-f",
        "{{.State.OOMKilled}} {{.State.ExitCode}}",
        id,
      ]);
      const [oom] = state.stdout.trim().split(" ");
      timedOut = finished.code === 137 && oom !== "true";
    }

    // Before the `finally` below destroys it. A timed-out container is still
    // running at this point, and taking a file off a container mid-run is fine:
    // whatever is there is what it managed to write, which is exactly what the
    // caller wants to see.
    const produced = await collectFrom(id, collect ?? []);

    return {
      stdout: finished.stdout,
      stderr: finished.stderr,
      code: finished.code,
      timedOut,
      elapsedMs: Date.now() - started,
      files: produced,
    };
  } finally {
    // -f because a timed-out container is still running, and this is the only
    // thing standing between a killed job and a container that outlives it.
    await sh(["rm", "-f", id]).catch(() => undefined);
    if (staging) await rm(staging, { recursive: true, force: true });
  }
};

/**
 * The organiser's ceiling, read fresh for each run.
 *
 * Not memoised, unlike the settings most packages read once: a config edited to
 * tighten a limit should tighten the next run rather than the next restart. The
 * read costs nothing next to starting a container.
 *
 * A `machine:` block that will not parse stops the run. Core checks it at boot
 * against this same schema, so getting here means something changed underneath
 * the process, and the safe reading of an unreadable ceiling is that there is
 * one and we cannot see it.
 */
const ceiling = async (): Promise<MachineCeiling> => {
  const c = await unsafe(kit.get());
  const read = machine.safeParse(c.machine ?? {});
  if (!read.success) {
    throw new Error(
      `The machine: block in the config is not one this package can read, so no run can be confined to it: ${read.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  return read.data;
};

export default {
  name: "@open-competition-kit/machine-docker",
  description:
    "Runs each command in a Docker container, confined. Requires a Docker daemon on the host.",
  version: "0.0.8",
  config,
  machine: {
    /**
     * Not clamped, and deliberately so. The ceiling in the `machine:` block is
     * about the code a competitor sends; a recipe came from the config beside it
     * and needs the network the ceiling exists to deny.
     */
    build: async (request: BuildRequest) => ensure(sh, request),
    run: async (request: Requested) => {
      if (!request.image) {
        throw new Error(
          `This machine runs every command in a container and was given no ` +
            `image to start one from. Add an image: or a build: to the runner. ` +
            `Taking this package out of with: would also work, and would run ` +
            `the command on the host with nothing confining it.`,
        );
      }
      const image = request.image;
      return run({ ...request, image, ...clamp(request, await ceiling()) });
    },
  },
} satisfies Package;
