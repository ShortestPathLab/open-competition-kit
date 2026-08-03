import { describe, expect, it } from "bun:test";
import JSZip from "jszip";
import { select } from "./source";

/** The paths in an archive, in the shape `select` reads them. */
const zip = async (paths: readonly string[]) => {
  const archive = new JSZip();
  for (const path of paths) archive.file(path, `contents of ${path}`);
  return await JSZip.loadAsync(await archive.generateAsync({ type: "uint8array" }));
};

const paths = async (
  entries: readonly string[],
  allow?: readonly string[],
) => Object.keys(await select(await zip(entries), { allow })).sort();

describe("select", () => {
  it("takes the whole archive when nothing is allowlisted", async () => {
    expect(await paths(["a.py", "b/c.py"])).toEqual(["a.py", "b/c.py"]);
  });

  it("keeps only the permitted files", async () => {
    // The point of the allowlist. `pacman.py` is the harness, and a submission
    // that ships one is a submission trying to mark itself.
    expect(
      await paths(
        ["solvers/q1a_solver.py", "pacman.py", "sitecustomize.py"],
        ["solvers/q1a_solver.py"],
      ),
    ).toEqual(["solvers/q1a_solver.py"]);
  });

  it("strips the directory a GitHub archive wraps everything in", async () => {
    // The wrapper is named after the repository and the ref, so a runner cannot
    // know it in advance and should not have to.
    expect(
      await paths(
        ["agent-main/solvers/q1a_solver.py", "agent-main/README.md"],
        ["solvers/q1a_solver.py"],
      ),
    ).toEqual(["solvers/q1a_solver.py"]);
  });

  it("keys a wrapped archive by the paths the allowlist was written in", async () => {
    // The combination that matters: a GitHub zip, and a pattern the organiser
    // wrote against the repository rather than against the download.
    expect(
      await paths(
        ["agent-main/problems/q1a.py", "agent-main/problems/q1b.py"],
        ["problems/*.py"],
      ),
    ).toEqual(["problems/q1a.py", "problems/q1b.py"]);
  });

  it("leaves two top-level directories alone", async () => {
    // Not a wrapper, just two directories. Stripping one would merge them.
    expect(await paths(["a/x.py", "b/y.py"])).toEqual(["a/x.py", "b/y.py"]);
  });

  it("matches a glob within one directory level", async () => {
    expect(
      await paths(
        ["problems/q1a.py", "problems/q1b.py", "problems/vendor/evil.py"],
        ["problems/*.py"],
      ),
    ).toEqual(["problems/q1a.py", "problems/q1b.py"]);
  });

  it("crosses directories only for a double star", async () => {
    expect(
      await paths(
        ["problems/q1a.py", "problems/vendor/nested.py"],
        ["problems/**.py"],
      ),
    ).toEqual(["problems/q1a.py", "problems/vendor/nested.py"]);
  });

  it("names every missing literal at once", async () => {
    // A competitor who forgot two files should learn that in one submission.
    expect(
      select(await zip(["a.py"]), { allow: ["a.py", "b.py", "c.py"] }),
    ).rejects.toThrow(/b\.py, c\.py/);
  });

  it("does not mind a glob that matches nothing", async () => {
    // A family with no members is a legitimate submission. A named file that is
    // absent is not.
    expect(await paths(["a.py"], ["extras/*.py"])).toEqual([]);
  });

  it("does not treat a dot in a pattern as a wildcard", async () => {
    expect(await paths(["qXpy", "q.py"], ["q.py"])).toEqual(["q.py"]);
  });

  it("ignores directory entries", async () => {
    const archive = new JSZip();
    archive.folder("empty");
    archive.file("a.py", "x");
    const loaded = await JSZip.loadAsync(
      await archive.generateAsync({ type: "uint8array" }),
    );

    expect(Object.keys(await select(loaded))).toEqual(["a.py"]);
  });
});
