import { describe, expect, it } from "bun:test";
import { isFile, keyOf, makeKey, toFileRef, FILE_REF } from "./file";

describe("makeKey", () => {
  const base = {
    namespace: "open-competition-kit/namespace/submission",
    owner: "sub_1",
    id: "file_1",
  };

  it("scopes a key by namespace, owner, and id", () => {
    expect(makeKey({ ...base, name: "agent.zip" })).toBe(
      "submission/sub_1/file_1/agent.zip",
    );
  });

  it("refuses to let a filename escape its directory", () => {
    // The classic: a client names its upload "../../../etc/passwd". The name may
    // keep dots, but it must not contribute a path separator — with no `/`, the
    // remaining `..` is an ordinary character in a filename and traverses nothing.
    const key = makeKey({ ...base, name: "../../../etc/passwd" });
    const prefix = "submission/sub_1/file_1/";

    expect(key.startsWith(prefix)).toBe(true);
    expect(key.slice(prefix.length)).not.toContain("/");
    expect(key.split("/")).not.toContain("..");
  });

  it("strips leading dots so a name cannot become a dotfile", () => {
    expect(makeKey({ ...base, name: ".bashrc" })).toBe(
      "submission/sub_1/file_1/bashrc",
    );
  });

  it("keeps two uploads from colliding, even with the same filename", () => {
    const a = makeKey({ ...base, id: "file_1", name: "agent.zip" });
    const b = makeKey({ ...base, id: "file_2", name: "agent.zip" });
    expect(a).not.toBe(b);
  });

  it("survives a missing or hostile name", () => {
    expect(makeKey(base)).toBe("submission/sub_1/file_1/file");
    expect(makeKey({ ...base, name: "///" })).toBe(
      "submission/sub_1/file_1/___",
    );
  });
});

describe("FileRef", () => {
  it("round-trips through the reference a database field would hold", () => {
    const ref = toFileRef(
      { key: "submission/s/f/agent.zip", size: 2048, checksum: "abc" },
      "agent.zip",
    );

    expect(ref.$type).toBe(FILE_REF);
    expect(ref.size).toBe(2048);
    expect(isFile(ref)).toBe(true);
    expect(isFile(JSON.parse(JSON.stringify(ref)))).toBe(true);
  });

  it("does not mistake arbitrary objects for a file reference", () => {
    expect(isFile({ key: "x", size: 1 })).toBe(false);
    expect(isFile("some-key")).toBe(false);
    expect(isFile(null)).toBe(false);
  });

  it("addresses a file by either its ref or its bare key", () => {
    const ref = toFileRef({ key: "a/b/c", size: 1 });
    expect(keyOf(ref)).toBe("a/b/c");
    expect(keyOf("a/b/c")).toBe("a/b/c");
  });
});
