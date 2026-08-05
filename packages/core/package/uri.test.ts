import { describe, expect, test } from "bun:test";
import { canonicalise, isPackageUriError, parseRef, PackageUriError } from "./uri";

const ok = (specifier: string) => {
  const ref = parseRef(specifier);
  if (isPackageUriError(ref)) throw new Error(ref.message);
  return ref;
};

const err = (specifier: string) => {
  const ref = parseRef(specifier);
  expect(ref).toBeInstanceOf(PackageUriError);
  return ref as PackageUriError;
};

describe("bare specifiers", () => {
  test("read a leading dot or slash as a path", () => {
    expect(ok("./packages/noop")).toMatchObject({ scheme: "local", id: "./packages/noop" });
    expect(ok("../elsewhere")).toMatchObject({ scheme: "local" });
    expect(ok("/packages/noop")).toMatchObject({ scheme: "local" });
  });

  test("read a scoped name as npm", () => {
    expect(ok("@open-competition-kit/standard")).toMatchObject({
      scheme: "npm",
      id: "@open-competition-kit/standard",
      version: undefined,
    });
  });

  // npm has no unscoped name with a slash in it, which is what makes this safe to
  // decide without asking.
  test("read org/repo as github", () => {
    expect(ok("someone/their-package")).toMatchObject({
      scheme: "github",
      id: "someone/their-package",
    });
  });

  // A bare word is a valid unscoped npm name and also how a built-in would be
  // written, so it is not decided here.
  test("refuse a bare word", () => {
    expect(err("standard").message).toContain("Write the scheme");
  });
});

describe("versions", () => {
  // The `@` that opens a scope is not the `@` that opens a version. Splitting on
  // the first one turns every scoped name into a versionless mess.
  test("split a scoped name on the last @", () => {
    expect(ok("npm:@open-competition-kit/standard@0.0.11")).toMatchObject({
      scheme: "npm",
      id: "@open-competition-kit/standard",
      version: "0.0.11",
    });
  });

  test("leave a scoped name with no version unversioned", () => {
    expect(ok("npm:@scope/name").version).toBeUndefined();
  });

  test("read an unscoped name with a version", () => {
    expect(ok("npm:lodash@4.17.21")).toMatchObject({ id: "lodash", version: "4.17.21" });
  });

  test("accept a github ref after a hash", () => {
    expect(ok("github:someone/pkg#a1b2c3d")).toMatchObject({
      scheme: "github",
      id: "someone/pkg",
      version: "a1b2c3d",
    });
  });

  // A directory may legitimately have an `@` in its name, and a path is already
  // an exact reference to whatever sits at the end of it.
  test("do not read a version off a path", () => {
    expect(ok("local:./packages/@scoped/thing")).toMatchObject({
      id: "./packages/@scoped/thing",
      version: undefined,
    });
  });
});

describe("qualified specifiers", () => {
  test("name the schemes when one is misspelled", () => {
    expect(err("nmp:thing").message).toContain("`npm:`");
  });

  // Preserves what the resolver did before this existed, where a URL failed with
  // NotImplementedError rather than being treated as a path.
  test("refuse https, which is not implemented", () => {
    expect(err("https://example.com/pkg").message).toContain("not a scheme");
  });

  test("refuse a scheme with nothing after it", () => {
    expect(err("npm:").message).toContain("names nothing");
  });
});

describe("canonicalise", () => {
  const resolveLocal = (p: string) => `/config/dir/${p.replace(/^\.\//, "")}`;

  // The bug this exists for: two spellings of one package survive `uniq` in
  // `withAt` as two entries, so the package joins the chain twice and contributes
  // its config fields twice.
  test("gives two spellings of one path the same uri", () => {
    const bare = canonicalise("./pkg", resolveLocal);
    const qualified = canonicalise("local:./pkg", resolveLocal);
    expect(isPackageUriError(bare) || isPackageUriError(qualified)).toBe(false);
    expect((bare as { uri: string }).uri).toBe((qualified as { uri: string }).uri);
    expect((bare as { uri: string }).uri).toBe("local:/config/dir/pkg");
  });

  test("leaves a remote ref alone", () => {
    expect(canonicalise("npm:@scope/name@1.0.0", resolveLocal)).toMatchObject({
      uri: "npm:@scope/name@1.0.0",
    });
  });
});
