/**
 * The JavaScript half of the evaluation protocol.
 *
 * The same three functions the Python shim looks for, found the way JavaScript
 * finds things. A program exports them, as named exports or on a default object:
 *
 *     export function plan(params) {}            // optional
 *     export function evaluate({ case_, submission }) {}
 *     export function reduce({ results }) {}     // optional
 *
 * Arguments arrive as one object rather than by reflection over the parameter
 * list, because a JavaScript function's parameter names are not reliably
 * readable and destructuring already gives the same thing at the call site.
 * `case` is a reserved word, so it is `case_` in the object and `case` in the
 * config and the logs.
 *
 * Each phase runs in its own container. `plan` and `reduce` run with no
 * submission anywhere near them; `evaluate` runs once per case with the
 * permitted files of one submission. Without `plan` there is a single unnamed
 * case, and without `reduce` the numbers are summed.
 *
 * Print whatever you like. Both streams are the job's log, and the answer
 * travels by file, so nothing a program or a harness writes can be mistaken for
 * it.
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REQUEST = "/ock/request.json";
const REPLY = "/tmp/ock-reply.json";
const WORK = "/ock/work";
const PROGRAM = join(WORK, "program.mjs");

/**
 * The permitted files of one submission, on disk.
 *
 * Only the paths the competition allowed. The rest of the archive was discarded
 * before this container started, so an edited harness is not here to be found.
 */
class Submission {
  constructor(root, files) {
    this.root = root;
    this.files = Object.freeze([...files]);
  }

  /** The absolute path of one submitted file. */
  path(name) {
    return join(this.root, name);
  }

  /** One submitted file, as a Buffer. */
  read(name) {
    return readFileSync(this.path(name));
  }

  /**
   * Lay the submission over a directory, keeping its structure.
   *
   * What a competition whose image holds a harness wants: the files land on top
   * of the copy of the harness in this container, which is thrown away with it.
   */
  copyInto(directory) {
    for (const name of this.files) {
      const target = join(directory, name);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(this.path(name), target);
    }
    return directory;
  }
}

/**
 * Sum the numbers, and count the cases.
 *
 * Deliberately the least clever thing that produces a rankable row. Anything
 * beyond addition is a scoring decision, and those belong in a competition's own
 * `reduce` rather than in a default that has to guess. Booleans are left out
 * because `true + true` is 2 and means nothing on a leaderboard.
 */
function defaultReduce(results) {
  const total = {};
  for (const result of results) {
    if (!result || typeof result !== "object" || Array.isArray(result)) continue;
    for (const [key, value] of Object.entries(result)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      total[key] = (total[key] ?? 0) + value;
    }
  }
  total.cases = results.length;
  return total;
}

/** Named exports first, then a default object, so both conventions work. */
function pick(program, name) {
  const direct = program?.[name];
  if (typeof direct === "function") return direct;
  const onDefault = program?.default?.[name];
  return typeof onDefault === "function" ? onDefault : undefined;
}

async function run(request, program) {
  const params = request.params ?? {};
  const job = request.job;

  if (request.phase === "plan") {
    const plan = pick(program, "plan");
    // One unnamed case. A competition that does not fan out still goes through
    // every phase, so there is one code path rather than two.
    if (!plan) return [null];
    const cases = await plan({ params, job });
    if (cases == null) return [null];
    if (!Array.isArray(cases)) {
      throw new TypeError(`plan() must return an array of cases, got ${typeof cases}`);
    }
    return cases;
  }

  if (request.phase === "evaluate") {
    const evaluate = pick(program, "evaluate");
    if (!evaluate) {
      throw new Error(
        "The evaluation program exports no evaluate(). It is the one function a " +
          "competition has to write.",
      );
    }
    const source = request.submission ?? {};
    return await evaluate({
      case_: request.case ?? null,
      params,
      submission: new Submission(source.root ?? "", source.files ?? []),
      job,
    });
  }

  if (request.phase === "reduce") {
    const results = request.results ?? [];
    const reduce = pick(program, "reduce");
    if (!reduce) return defaultReduce(results);
    return await reduce({ results, cases: request.cases ?? [], params, job });
  }

  throw new Error(`Unknown phase ${JSON.stringify(request.phase)}`);
}

async function main() {
  let replyPath = REPLY;
  let payload;
  let status = 0;

  try {
    process.chdir(WORK);
  } catch {
    // No work directory means no program, which the load below reports properly.
  }

  try {
    const request = JSON.parse(readFileSync(REQUEST, "utf8"));
    // The host's path wins over the constant, so the two can disagree during an
    // upgrade without the answer landing where nobody is looking.
    replyPath = request.reply || REPLY;
    // By URL, because a bare absolute path is a package specifier on Windows and
    // an ambiguous one everywhere else.
    const program = await import(pathToFileURL(resolve(PROGRAM)).href);
    payload = { ok: true, value: await run(request, program) };
  } catch (error) {
    // Reported rather than thrown. The stack belongs in the job's log where a
    // competitor or an organiser can read it, and a bare non-zero exit would
    // leave the host guessing which phase died and why.
    payload = { ok: false, error: error?.stack ?? String(error) };
    status = 1;
  }

  writeFileSync(
    replyPath,
    // A replacer rather than a bare stringify, so a program returning something
    // JSON has no word for fails as a readable value rather than as a throw out
    // of the shim. The host checks the shape afterwards and names the key.
    JSON.stringify(payload, (_key, value) =>
      typeof value === "bigint" || typeof value === "function" ?
        String(value)
      : value,
    ) ?? '{"ok":false,"error":"the program returned something JSON cannot hold"}',
  );

  process.exit(status);
}

await main();
