import { BunContext } from "@effect/platform-bun";
import { afterEach, describe, expect, it } from "bun:test";
import { Effect as E } from "effect";
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupOf, probeWritable, writeConfigFile } from "./writable";

const run = <A>(effect: E.Effect<A, never, never>) => E.runPromise(effect);

const directories: string[] = [];

const temporary = () => {
  const directory = mkdtempSync(join(tmpdir(), "ock-config-"));
  directories.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("probeWritable", () => {
  it("reports an ordinary file as writable, replaced by rename", async () => {
    const directory = temporary();
    const path = join(directory, "competition.config.yaml");
    writeFileSync(path, "appName: GPPC\n");

    const report = await run(probeWritable(path).pipe(E.provide(BunContext.layer)));

    expect(report.writable).toBe(true);
    expect(report.reason).toBe("ok");
    // A writable directory on the same filesystem, so the new file can be put
    // in place with a rename and a reader never sees a half written config.
    expect(report.strategy).toBe("rename");
  });

  it("reports a file this user cannot write", async () => {
    const directory = temporary();
    const path = join(directory, "competition.config.yaml");
    writeFileSync(path, "appName: GPPC\n");
    chmodSync(path, 0o444);

    const report = await run(probeWritable(path).pipe(E.provide(BunContext.layer)));

    expect(report.writable).toBe(false);
    expect(report.reason).toBe("notPermitted");
    // Named, because the fix is somewhere else entirely: whoever owns the file.
    expect(report.detail).toContain(path);
  });

  it("reports a file that is not there", async () => {
    const report = await run(
      probeWritable(join(temporary(), "gone.yaml")).pipe(E.provide(BunContext.layer)),
    );

    expect(report.writable).toBe(false);
    expect(report.reason).toBe("missing");
  });
});

describe("writeConfigFile", () => {
  it("replaces the file and keeps the previous contents beside it", async () => {
    const directory = temporary();
    const path = join(directory, "competition.config.yaml");
    writeFileSync(path, "appName: Old\n");

    await run(
      writeConfigFile({
        path,
        previous: "appName: Old\n",
        next: "appName: New\n",
        strategy: "rename",
      }).pipe(E.provide(BunContext.layer), E.orDie),
    );

    expect(readFileSync(path, "utf8")).toBe("appName: New\n");
    expect(readFileSync(backupOf(path), "utf8")).toBe("appName: Old\n");
  });

  it("keeps the permissions the config file had", async () => {
    const directory = temporary();
    const path = join(directory, "competition.config.yaml");
    writeFileSync(path, "appName: Old\n");
    // A config holds secrets, and somebody who tightened this file did it on
    // purpose. Renaming a fresh file over it would hand it back at 0644.
    chmodSync(path, 0o600);

    await run(
      writeConfigFile({
        path,
        previous: "appName: Old\n",
        next: "appName: New\n",
        strategy: "rename",
      }).pipe(E.provide(BunContext.layer), E.orDie),
    );

    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it("writes through the same file when it cannot be replaced", async () => {
    const directory = temporary();
    const path = join(directory, "competition.config.yaml");
    writeFileSync(path, "appName: Old\n");
    const before = statSync(path).ino;

    await run(
      writeConfigFile({
        path,
        previous: "appName: Old\n",
        next: "appName: New\n",
        strategy: "inPlace",
      }).pipe(E.provide(BunContext.layer), E.orDie),
    );

    expect(readFileSync(path, "utf8")).toBe("appName: New\n");
    // The same file, not a replacement for it. This is the path a config bind
    // mounted on its own takes, where replacing the inode is what fails.
    expect(statSync(path).ino).toBe(before);
  });

  it("leaves no temporary file behind", async () => {
    const directory = temporary();
    const path = join(directory, "competition.config.yaml");
    writeFileSync(path, "appName: Old\n");

    await run(
      writeConfigFile({
        path,
        previous: "appName: Old\n",
        next: "appName: New\n",
        strategy: "rename",
      }).pipe(E.provide(BunContext.layer), E.orDie),
    );

    expect(() => statSync(`${path}.ock-tmp`)).toThrow();
  });
});
