import { describe, expect, it } from "bun:test";
import { editDocument, type DocumentEdit } from "./document";

const SOURCE = `# What this file is for.
name: GPPC
competitions:
  - id: alpha
    name: Alpha # the friendly name
    # Shown at the top of the competition page.
    description: The first one.
    banner: \${{ dataUrl("./assets/banner.svg") }}
    tracks:
      - id: main
        name: Main
      - id: extra
        name: Extra
  - id: beta
    name: Beta
`;

const edit = (path: string, keys: DocumentEdit["keys"], values: DocumentEdit["values"]) => ({
  path,
  keys,
  values,
});

const editedTo = (edits: DocumentEdit[]) => {
  const result = editDocument(SOURCE, edits);
  if (!result.source) throw new Error(result.issues.map((issue) => issue.message).join("; "));
  return result.source;
};

describe("editDocument", () => {
  it("gives back the same bytes when there is nothing to change", () => {
    // The property the whole approach rests on. A save that reformats the parts
    // nobody edited is a save nobody can review.
    expect(editDocument(SOURCE, []).source).toBe(SOURCE);
  });

  it("keeps the comment written beside a value it replaces", () => {
    const out = editedTo([edit("c.alpha", ["competitions", 0], { name: "Alpha Cup" })]);

    expect(out).toContain("name: Alpha Cup # the friendly name");
    // And leaves everything else exactly as it was.
    expect(out).toContain("    # Shown at the top of the competition page.\n");
    expect(out).toContain("name: GPPC\n");
  });

  it("writes multi-line text as a block scalar", () => {
    const out = editedTo([
      edit("c.alpha", ["competitions", 0], { description: "- Be nice\n- Be quick" }),
    ]);

    // Markdown, which is what these fields hold. Folded style would join the
    // two list items onto one line, and quoted style would put \n in the file.
    expect(out).toContain("description: |-\n      - Be nice\n      - Be quick\n");
  });

  it("adds a field the config never had", () => {
    const out = editedTo([edit("c.alpha", ["competitions", 0], { organiser: "Monash" })]);
    expect(out).toContain("organiser: Monash");
  });

  it("adds a field to a file that stops mid-line", () => {
    // A hand-edited file often has no newline at the end, and appending to one
    // without noticing puts the new key on the end of the old value.
    const result = editDocument("name: GPPC\ndescription: The first one", [
      edit("c", [], { organiser: "Monash" }),
    ]);

    expect(result.source).toBe("name: GPPC\ndescription: The first one\norganiser: Monash\n");
  });

  it("removes a field rather than setting it to nothing", () => {
    const out = editedTo([edit("c.alpha", ["competitions", 0], { description: undefined })]);

    // An absent key and a null are different things to a package schema: one is
    // unset, the other is a value it has to accept.
    expect(out).not.toContain("description:");
    expect(out).toContain("name: Alpha");
  });

  it("leaves a long line somewhere else exactly as it was", () => {
    const long = `description: GPPC\nicon: \${{ dataUrl("../a-rather-long-relative-path/assets/competition-icon.svg") }}\nname: Alpha\n`;
    const result = editDocument(long, [edit("c", [], { name: "Alpha Cup" })]);

    // The reason this file goes through the concrete syntax tree at all. The
    // ordinary stringifier re-renders every value, and a plain scalar past the
    // line width comes back folded across three lines that nobody edited.
    expect(result.source).toContain(
      'icon: ${{ dataUrl("../a-rather-long-relative-path/assets/competition-icon.svg") }}\n',
    );
    expect(result.source).toContain("name: Alpha Cup\n");
  });

  it("writes a replacement the way the author wrote the field", () => {
    const quoted = `name: "Alpha"\nlabel: Beta\n`;
    const result = editDocument(quoted, [edit("c", [], { name: "Alpha Cup", label: "Beta Cup" })]);

    // Quoting a string that does not need it is a choice somebody made about
    // their own file, and it is not this editor's to undo.
    expect(result.source).toBe(`name: "Alpha Cup"\nlabel: Beta Cup\n`);
  });

  it("quotes a value that would otherwise read as something else", () => {
    const result = editDocument(`version: one\n`, [edit("c", [], { version: "42" })]);

    // Written plainly this comes back as the number 42, and the package that
    // asked for a string gets one at boot and not at save.
    expect(result.source).toBe(`version: "42"\n`);
  });

  it("replaces a value that is a whole block", () => {
    const withBlock = `board:\n  rank:\n    field: total\n    order: desc\n`;
    const result = editDocument(withBlock, [
      edit("c.board", ["board"], { rank: { field: "runtime", order: "asc" } }),
    ]);

    expect(result.source).toBe("board:\n  rank:\n    field: runtime\n    order: asc\n");
  });

  it("keeps the first key of a list entry on the line that opened it", () => {
    const source = `competitions:\n  - id: alpha\n    name: Alpha\n`;
    const result = editDocument(source, [edit("c.alpha", ["competitions", 0], { id: undefined })]);

    // `- ` and the first key share a line. Removing that key without moving the
    // next one up leaves the map starting at two different indents, which is not
    // the same document and may not be a document at all.
    expect(result.source).toBe("competitions:\n  - name: Alpha\n");
  });

  it("says so rather than rewriting a block written inline", () => {
    const inline = `db: { provider: postgresql }\n`;
    const result = editDocument(inline, [edit("c.db", ["db"], { provider: "sqlite" })]);

    expect(result.source).toBeUndefined();
    expect(result.issues[0]?.message).toContain("written inline");
  });

  it("finds a track by the index its id maps to", () => {
    const out = editedTo([
      edit("c.alpha.tracks.extra", ["competitions", 0, "tracks", 1], { name: "Extras" }),
    ]);

    expect(out).toContain("name: Extras");
    expect(out).toContain("name: Main");
  });

  it("refuses a field whose value comes from an interpolation", () => {
    const result = editDocument(SOURCE, [
      edit("c.alpha", ["competitions", 0], { banner: "data:image/png;base64,AAAA" }),
    ]);

    expect(result.source).toBeUndefined();
    // Writing what the editor was shown would replace the reference with the
    // resolved value, which for `env()` means a secret in a committed file.
    expect(result.issues[0]?.message).toContain('dataUrl("./assets/banner.svg")');
  });

  it("refuses a node that lives in an included file", () => {
    const included = `competitions:\n  - \${{ yaml("./alpha.yaml") }}\n`;
    const result = editDocument(included, [
      edit("c.alpha", ["competitions", 0], { name: "Alpha Cup" }),
    ]);

    expect(result.source).toBeUndefined();
    expect(result.issues[0]?.message).toContain('yaml("./alpha.yaml")');
  });

  it("reports a node that is not in the file at all", () => {
    const result = editDocument(SOURCE, [edit("c.gamma", ["competitions", 7], { name: "Gamma" })]);

    expect(result.source).toBeUndefined();
    expect(result.issues[0]?.message).toContain("changed since this page loaded");
  });

  it("saves nothing when one edit of several cannot be placed", () => {
    const result = editDocument(SOURCE, [
      edit("c.alpha", ["competitions", 0], { name: "Alpha Cup" }),
      edit("c.gamma", ["competitions", 7], { name: "Gamma" }),
    ]);

    // Half a save is worse than none: the organiser is left reading a diff to
    // find out which half, and the half that landed was checked as though the
    // other half were there too.
    expect(result.source).toBeUndefined();
  });
});
