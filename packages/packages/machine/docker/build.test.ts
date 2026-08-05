import { describe, expect, it } from "bun:test";
import { ensure, tagFor, type Docker } from "./build";

const RECIPE = "FROM python:3.13-slim\nRUN pip install numpy\n";

/** A daemon that has nothing and records what it was asked. */
const daemon = (has: string[] = []) => {
  const calls: string[][] = [];
  const docker: Docker = async (args) => {
    calls.push(args);
    if (args[0] === "image" && args[1] === "inspect") {
      return {
        stdout: "",
        stderr: "",
        code: has.includes(args[2] ?? "") ? 0 : 1,
      };
    }
    return { stdout: "sha256:abc", stderr: "", code: 0 };
  };
  return { docker, calls, builds: () => calls.filter((c) => c[0] === "build") };
};

describe("tagFor", () => {
  it("is stable for the same inputs", async () => {
    expect(await tagFor({ dockerfile: RECIPE })).toBe(await tagFor({ dockerfile: RECIPE }));
  });

  it("changes when the recipe changes", async () => {
    expect(await tagFor({ dockerfile: RECIPE })).not.toBe(
      await tagFor({ dockerfile: RECIPE + "RUN pip install scipy\n" }),
    );
  });

  it("changes when a build argument changes", async () => {
    // Two harnesses out of one recipe. A hash that ignored these would serve a
    // competition the branch a different competition asked for.
    expect(await tagFor({ dockerfile: RECIPE, args: { REF: "a1" } })).not.toBe(
      await tagFor({ dockerfile: RECIPE, args: { REF: "main" } }),
    );
  });

  it("does not care what order arguments were written in", async () => {
    expect(await tagFor({ dockerfile: RECIPE, args: { A: "1", B: "2" } })).toBe(
      await tagFor({ dockerfile: RECIPE, args: { B: "2", A: "1" } }),
    );
  });

  it("keeps the requested name as a readable prefix", async () => {
    expect(await tagFor({ dockerfile: RECIPE, tag: "pacman" })).toStartWith("pacman:");
  });

  it("sanitises a name Docker would refuse", async () => {
    // A competition id is not a tag. `FIT5047` is a perfectly good id and an
    // invalid tag, and the resulting error talks about tags.
    const tag = await tagFor({ dockerfile: RECIPE, tag: "FIT5047 Pacman!" });
    expect(tag).toMatch(/^[a-z0-9][a-z0-9._-]*:[0-9a-f]+$/);
  });
});

describe("ensure", () => {
  it("builds when the daemon does not have the image", async () => {
    const { docker, builds } = daemon();
    const result = await ensure(docker, { dockerfile: RECIPE });

    expect(result.built).toBe(true);
    expect(result.image).toBe(await tagFor({ dockerfile: RECIPE }));
    expect(builds()).toHaveLength(1);
  });

  it("does not build when the image is already there", async () => {
    const image = await tagFor({ dockerfile: RECIPE });
    const { docker, builds } = daemon([image]);

    const result = await ensure(docker, { dockerfile: RECIPE });

    expect(result.built).toBe(false);
    expect(builds()).toHaveLength(0);
  });

  it("passes build arguments through", async () => {
    const { docker, builds } = daemon();
    await ensure(docker, { dockerfile: RECIPE, args: { REF: "a1" } });

    expect(builds()[0]).toContain("--build-arg");
    expect(builds()[0]).toContain("REF=a1");
  });

  it("builds once when several callers ask at the same time", async () => {
    // The runner service starts every pending job in one Promise.all, so the
    // first poll after a restart asks for the same image several times over.
    const { docker, builds } = daemon();

    const results = await Promise.all(
      Array.from({ length: 5 }, () => ensure(docker, { dockerfile: RECIPE })),
    );

    expect(builds()).toHaveLength(1);
    expect(new Set(results.map((r) => r.image)).size).toBe(1);
  });

  it("reports the log when a recipe fails", async () => {
    const docker: Docker = async (args) =>
      args[0] === "build"
        ? { stdout: "", stderr: "E: Unable to locate package nope", code: 1 }
        : { stdout: "", stderr: "", code: 1 };

    // Docker writes progress and failures to stderr, so a message built from
    // stdout alone would be empty for every case worth reading.
    expect(ensure(docker, { dockerfile: "FROM scratch\nRUN nope\n" })).rejects.toThrow(
      /Unable to locate package nope/,
    );
  });
});
