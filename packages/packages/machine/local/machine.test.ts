import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { local } from "./machine";

/**
 * Under a temp directory rather than under `/ock`, which is where a real run
 * puts things. The machine writes wherever it is told, so a test can tell it
 * somewhere a test user may write, and everything below is the same code path a
 * job takes.
 */
const roots: string[] = [];
const scratch = async () => {
  const root = await mkdtemp(join(tmpdir(), "ock-machine-test-"));
  roots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("the local machine", () => {
  test("runs a command and hands back what it printed", async () => {
    const root = await scratch();
    const result = await local.run({
      command: ["sh", "-c", "echo out; echo err >&2"],
      cwd: root,
    });

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("out");
    expect(result.stderr.trim()).toBe("err");
    expect(result.timedOut).toBe(false);
  });

  test("places the files it was given and collects what was asked for", async () => {
    const root = await scratch();
    const result = await local.run({
      command: ["sh", "-c", "cat request.json > reply.json"],
      cwd: root,
      files: { [join(root, "request.json")]: '{"phase":"plan"}' },
      collect: [join(root, "reply.json")],
    });

    const written = result.files[join(root, "reply.json")];
    expect(written).toBeDefined();
    expect(new TextDecoder().decode(written)).toBe('{"phase":"plan"}');
  });

  test("clears a stale collected file before the command starts", async () => {
    const root = await scratch();
    const reply = join(root, "reply.json");
    await writeFile(reply, "the case before");

    // A command that writes nothing. With a container the reply would be absent
    // because the filesystem is new; here it is absent because the run took the
    // old one away, and the two have to look the same or a failed case scores
    // whatever the case before it did.
    const result = await local.run({
      command: ["sh", "-c", "true"],
      cwd: root,
      collect: [reply],
    });

    expect(result.files[reply]).toBeUndefined();
  });

  test("takes away what it created", async () => {
    const root = await scratch();
    const nested = join(root, "made", "up", "deep");

    await local.run({
      command: ["sh", "-c", "true"],
      cwd: root,
      files: { [join(nested, "program.py")]: "print()" },
    });

    expect(await Bun.file(join(nested, "program.py")).exists()).toBe(false);
    expect(await Bun.file(join(root, "made")).exists()).toBe(false);
  });

  test("takes its files away again when the command never starts", async () => {
    const root = await scratch();
    const program = join(root, "made", "program.py");

    const attempt = local.run({
      command: ["ock-not-a-real-command"],
      cwd: root,
      files: { [program]: "print()" },
    });

    await expect(attempt).rejects.toThrow(/machine-docker/);
    expect(await Bun.file(program).exists()).toBe(false);
    expect(await Bun.file(join(root, "made")).exists()).toBe(false);
  });

  test("takes away a work directory it had to invent", async () => {
    const root = await scratch();

    await local.run({
      command: ["sh", "-c", "pwd"],
      cwd: join(root, "invented", "work"),
    });

    expect(await Bun.file(join(root, "invented")).exists()).toBe(false);
  });

  test("kills a command that outstays the wall-clock limit", async () => {
    const root = await scratch();
    const result = await local.run({
      command: ["sh", "-c", "sleep 30"],
      cwd: root,
      timeoutMs: 250,
    });

    expect(result.timedOut).toBe(true);
    expect(result.elapsedMs).toBeLessThan(10_000);
  });

  test("queues concurrent runs instead of letting them share a path", async () => {
    const root = await scratch();
    const request = join(root, "request.json");
    const seen: string[] = [];

    // Each run writes its own name and reads back whatever is at the shared
    // path. Run in parallel without the queue, the second overwrites the first
    // before the first has read it, which is the failure the queue is for.
    const one = local
      .run({
        command: ["sh", "-c", "sleep 0.2; cat request.json"],
        cwd: root,
        files: { [request]: "first" },
      })
      .then((r) => seen.push(r.stdout.trim()));

    const two = local
      .run({
        command: ["sh", "-c", "cat request.json"],
        cwd: root,
        files: { [request]: "second" },
      })
      .then((r) => seen.push(r.stdout.trim()));

    await Promise.all([one, two]);
    expect(seen).toEqual(["first", "second"]);
  });

  test("refuses an image rather than running the command without one", async () => {
    const root = await scratch();
    const attempt = local.run({
      image: "python:3.12",
      command: ["python3", "--version"],
      cwd: root,
    });

    await expect(attempt).rejects.toThrow(/machine-docker/);
  });

  test("refuses to build, and says what would", async () => {
    await expect(local.build()).rejects.toThrow(/machine-docker/);
  });
});
