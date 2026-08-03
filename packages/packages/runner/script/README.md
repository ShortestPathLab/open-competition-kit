# @open-competition-kit/runner-script

Evaluates submissions with a program the organiser writes, instead of with a package.

The program is one file. It goes into `competition.config.yaml` through `text()`, so there is nothing to install, nothing to mount, and no `node_modules` beside your competition.

```yaml
with:
  - /packages/packages/standard
  - /packages/packages/sandbox/docker
  - /packages/packages/runner/script

competitions:
  - id: sorting
    runner:
      image: python:3.13-slim
      runtime: python
      program: ${{ text("./evaluate.py") }}
```

```python
def evaluate(submission):
    return {"score": len(submission.files)}
```

That is a working competition. Everything below is for competitions that need more.

## Languages

`runtime:` picks the shim that turns the protocol into functions. Two ship: `python` and `node`.

```yaml
runtime: node
program: ${{ text("./evaluate.mjs") }}
```

```js
export function evaluate({ submission }) {
  return { score: submission.files.length };
}
```

It is not guessed from the program, which arrives as text with no filename to read an extension off. Sniffing a shebang would be a rule that works until the day it does not.

Neither shim is the interface. Both read one JSON file and write another, and `command:` below lets a program in any language do the same without one.

## The three functions

```python
def plan(params):               # optional. What is there to do?
def evaluate(case, submission): # required. Do one of them.
def reduce(results):            # optional. Turn the answers into a row.
```

Each runs in its own container. `plan` once, `evaluate` once per case, `reduce` once at the end.

Without `plan` there is a single case and `case` is `None`. Without `reduce` the numbers are added up and a `cases` count is added. So a competition that does not fan out writes one function and never thinks about the other two.

| | `plan` | `evaluate` | `reduce` |
|---|---|---|---|
| `params` | yes | yes | yes |
| `job` | yes | yes | yes |
| `case` | | yes | |
| `submission` | | yes | |
| `results` | | | yes |
| `cases` | | | yes |

Python passes them by name, and gives each function only the ones it asks for. `def evaluate(case)` and `def evaluate(case, params, submission, job)` are both fine, and asking for a name that is not on offer fails with the list of names that are.

JavaScript passes them as one object to destructure, because a function's parameter names are not reliably readable there. `case` is a reserved word, so it arrives as `case_`.

```js
export function evaluate({ case_, submission, params, job }) {}
```

## Why a container per case

A submission that exhausts its memory, wedges its interpreter or spins forever takes its own container down and nothing else. One container for the whole evaluation would mean case three costing you cases four through forty, and a wall-clock limit generous enough for the entire suite, which is barely a limit.

It also puts a boundary between cases where progress can be written. A container reports nothing until it exits, so without the fan-out a competitor watching a ten minute evaluation would see nothing at all until it ended.

`plan` and `reduce` run with no submission in the container. A program that measures in `evaluate` and marks in `reduce` therefore never puts its benchmarks within reach of the code being marked.

## What `submission` is

The permitted files, on disk. The rest of the archive was discarded before the container started.

| Python | JavaScript | |
|---|---|---|
| `submission.root` | `submission.root` | where they are |
| `submission.files` | `submission.files` | the paths, relative to root |
| `submission.path("a.py")` | `submission.path("a.py")` | one absolute path |
| `submission.read("a.py")` | `submission.read("a.py")` | one file, as bytes |
| `submission.copy_into("/app")` | `submission.copyInto("/app")` | lay them over a directory |

The last one is what a competition whose image holds a harness wants: the files land on top of this container's copy of it, and the container is thrown away afterwards.

## Returning results

`evaluate` and `reduce` return a flat object of scalars, because that is what a leaderboard row is. A board builds its columns from the top-level keys and stringifies anything else, so a nested object arrives as JSON in a single cell with nothing to rank on. Returning one is an error naming the key rather than a quietly useless column.

Print whatever you like. Both streams become the job's log, including anything a subprocess wrote, so a harness's own words reach the competitor unedited. The answer travels by file and cannot be confused with any of it.

## Configuration

| Key | |
|---|---|
| `program` | The program, inlined. `${{ text("./evaluate.py") }}` |
| `runtime` | `python` or `node`. Required with `program`, unless `command` is given |
| `command` | Run this instead of a shim, and speak the protocol yourself |
| `image` | The image every phase runs in |
| `build` | A `dockerfile:`, optional `context:` and `args:`, built on startup instead |
| `include` | Files placed beside the program, keyed by relative path |
| `params` | Passed to every phase untouched |
| `submission.allow` | Paths a submission may supply, as literals or globs |
| `timeoutMs` | Wall-clock limit for one phase |
| `limits` | `memoryMb`, `cpus`, `pids`, `network` |

### Building the image

```yaml
build:
  dockerfile: ${{ text("./evaluate.dockerfile") }}
  args:
    HARNESS_REF: v2
```

Built when the runner service starts, and named after the contents of the recipe and its arguments. Editing the Dockerfile changes the name, and a changed name rebuilds. A fixed tag cannot do that, which is how a competition ends up scored against last month's harness with nothing anywhere reporting a problem.

A build has network access, since a recipe that installs anything needs one. The `sandbox:` ceiling governs runs, not builds. What protects you is where the inputs come from: the config, and never a submission.

### Files the kit does not read

```yaml
include:
  cases.yaml: ${{ text("./cases.yaml") }}
```

Copied in beside the program and never opened. This is how a project keeps its own list of instances, its scoring table or its reference outputs without this package inventing a vocabulary for something it does not understand. `plan` reads the file; the kit only moves the bytes.

Anything in `include` is readable by a submission while a case is being evaluated, because they share a container. So is the program itself. Data that must stay secret does not belong in either, and a competition that needs that guarantee wants a package rather than a program.

### The permitted files

```yaml
submission:
  allow:
    - solvers/*.py
    - agents/agent.py
```

Everything else in the archive is dropped before any container starts. Leave it out and the whole archive is taken, which is right when the submission is the answer and wrong when it overlays a harness. In the second case this is the only thing between a competitor and an edited marking script.

Patterns match by suffix, so the directory a GitHub archive wraps everything in does not need naming. `*` stops at a separator, `**` crosses them. A named file that is absent fails the submission, and every missing one is reported at once. A glob that matches nothing is not an error.

### Any other language

`command:` runs your program directly, with no shim between. This is why the package does not need to know your language exists: the protocol is two JSON files.

```yaml
image: golang:1.23
include:
  run.sh: ${{ text("./run.sh") }}
command: ["sh", "./run.sh"]
```

Read `/ock/request.json`, write the reply to the path its `reply` field names. The request carries `phase` (`plan`, `evaluate` or `reduce`), `params`, `case`, `submission`, `results`, `cases`, and `program`, which is where your program was placed. Answer with `{"ok": true, "value": ...}`, or `{"ok": false, "error": "..."}` to fail the phase with a message.

The command runs from the work directory, so a relative path finds a file placed by `include:`. The defaults a shim supplies are yours to write: no `plan` means returning `[null]`, and no `reduce` means summing the numbers.

## Requirements

The image needs a writable `/tmp` and whatever runs your program: `python3` for the Python shim, `node` for the JavaScript one, the first word of your `command:` otherwise. Both shims use only their standard library.

Install `sandbox/docker` alongside this, and mount the Docker socket into the runner service.
