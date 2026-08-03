import { config as kit, unsafe, type Package } from "@open-competition-kit/sdk";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { config, sandbox, type SandboxCeiling } from "./config";
import { clamp, type Confinement } from "./limits";

/**
 * Runs untrusted code in a Docker container.
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
 * The `sandbox:` block in the config is declared by this package and applied
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
};

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

const run = async ({
  image,
  command,
  files,
  env,
  cwd,
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
      `Could not create a sandbox from "${image}": ${created.stderr.trim()}`,
    );
  }
  const id = created.stdout.trim();

  // A staging directory, because `docker cp` copies paths and we were handed
  // bytes.
  let staging: string | undefined;
  try {
    if (files && Object.keys(files).length) {
      staging = await mkdtemp(join(tmpdir(), "ock-sandbox-"));
      for (const [path, body] of Object.entries(files)) {
        const local = join(staging, path.replace(/^\/+/, ""));
        await mkdir(dirname(local), { recursive: true });
        await writeFile(local, body as Uint8Array | string);
        const copied = await sh(["cp", local, `${id}:${path}`]);
        if (copied.code !== 0) {
          throw new Error(
            `Could not place "${path}" into the sandbox: ${copied.stderr.trim()}`,
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

    return {
      stdout: finished.stdout,
      stderr: finished.stderr,
      code: finished.code,
      timedOut,
      elapsedMs: Date.now() - started,
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
 * A `sandbox:` block that will not parse stops the run. Core checks it at boot
 * against this same schema, so getting here means something changed underneath
 * the process, and the safe reading of an unreadable ceiling is that there is
 * one and we cannot see it.
 */
const ceiling = async (): Promise<SandboxCeiling> => {
  const c = await unsafe(kit.get());
  const read = sandbox.safeParse(c.sandbox ?? {});
  if (!read.success) {
    throw new Error(
      `The sandbox: block in the config is not one this package can read, so no run can be confined to it: ${read.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  return read.data;
};

export default {
  name: "@open-competition-kit/sandbox-docker",
  description:
    "Runs untrusted code in Docker containers. Requires a Docker daemon on the host.",
  version: "0.0.8",
  config,
  sandbox: {
    run: async (request: Run) =>
      run({ ...request, ...clamp(request, await ceiling()) }),
  },
} satisfies Package;
