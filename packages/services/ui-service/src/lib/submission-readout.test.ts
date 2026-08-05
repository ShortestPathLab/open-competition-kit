import { describe, expect, it } from "vitest";
import { decodeValue, readBody, readResult, summariseBody } from "./submission-readout";

/**
 * The body `github:ref-select` writes: an object of answers whose single answer
 * is itself a JSON document, because a form control has one string to store and
 * this one has three things to say.
 */
const GITHUB_BODY = JSON.stringify({
  "github:ref": JSON.stringify({
    owner: "open-competition-kit-example",
    repo: "participant-spaaaacccee",
    ref: "example1",
  }),
});

describe("decodeValue", () => {
  it("reads a JSON-encoded object back as the object", () => {
    expect(decodeValue('{"ref":"main"}')).toEqual({ ref: "main" });
  });

  it("leaves a scalar written as a string alone", () => {
    // "42" is an answer somebody typed, not a number the form stored.
    expect(decodeValue("42")).toBe("42");
    expect(decodeValue("true")).toBe("true");
  });

  it("leaves a string that only looks like JSON alone", () => {
    expect(decodeValue("{not json")).toBe("{not json");
  });

  it("reaches an encoded value nested inside an object", () => {
    expect(decodeValue({ answer: '{"ref":"main"}' })).toEqual({
      answer: { ref: "main" },
    });
  });
});

describe("readBody", () => {
  it("unwraps an answer that was stored as JSON", () => {
    const [field] = readBody(GITHUB_BODY).fields;

    expect(field.label).toBe("Github Ref");
    expect(field.value).toEqual({
      owner: "open-competition-kit-example",
      repo: "participant-spaaaacccee",
      ref: "example1",
    });
  });

  it("gives a body that is not an object of answers a single unnamed field", () => {
    const { fields } = readBody("just some text");

    expect(fields).toHaveLength(1);
    expect(fields[0].label).toBe("");
    expect(fields[0].value).toBe("just some text");
  });

  it("recognises an uploaded file", () => {
    const body = JSON.stringify({
      archive: {
        $type: "open-competition-kit/file",
        name: "submission.zip",
        size: 143370,
      },
    });

    expect(readBody(body).fields[0].file).toEqual({
      name: "submission.zip",
      size: 143370,
    });
  });
});

describe("summariseBody", () => {
  it("describes an encoded answer without printing its JSON", () => {
    const { facts } = summariseBody(GITHUB_BODY);

    expect(facts).toEqual([
      { label: "Owner", value: "open-competition-kit-example" },
      { label: "Repo", value: "participant-spaaaacccee" },
      { label: "Ref", value: "example1" },
    ]);
    // The whole point: no braces reach the row.
    expect(facts.some((fact) => fact.value.includes("{"))).toBe(false);
  });

  it("names an uploaded file rather than its reference", () => {
    const body = JSON.stringify({
      archive: {
        $type: "open-competition-kit/file",
        name: "agent.zip",
        size: 1024,
      },
      approach: "Alpha-beta with iterative deepening",
    });

    const summary = summariseBody(body);

    expect(summary.file).toBe("agent.zip");
    expect(summary.facts).toEqual([
      { label: "Approach", value: "Alpha-beta with iterative deepening" },
    ]);
  });

  it("has nothing to say about an empty body", () => {
    expect(summariseBody("{}")).toEqual({ file: undefined, facts: [] });
  });
});

describe("readResult", () => {
  it("splits a runner's output into scores, diagnostics and a headline", () => {
    const readout = readResult({
      total: 10,
      score1: 10,
      score2: 0,
      status: "success",
      runtime: 24682,
      warning: false,
    });

    expect(readout.headline).toEqual({ key: "total", label: "Total", value: 10 });
    expect(readout.scores.map((score) => score.key)).toEqual(["score1", "score2"]);
    expect(readout.meta.map((entry) => entry.key)).toEqual(["status", "runtime", "warning"]);
  });

  it("scores a result the runner stringified", () => {
    expect(readResult('{"total":3.54}').headline).toEqual({
      key: "total",
      label: "Total",
      value: 3.54,
    });
  });
});
