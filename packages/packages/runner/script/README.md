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
      program: ${{ text("./evaluate.py") }}
```

```python
def evaluate(submission):
    return {"score": len(submission.files)}
```

That is a working competition. Everything below is for competitions that need more.

## The three functions

```python
def plan(params):               # optional. What is there to do?
def evaluate(case, submission): # required. Do one of them.
def reduce(results):            # optional. Turn the answers into a row.
```

Each runs in its own container. `plan` once, `evaluate` once per case, `reduce` once at the end.

Without `plan` there is a single case and `case` is `None`. Without `reduce` the numbers are added up and a `cases` count is added. So a competition that does not fan out writes one function and never thinks about the other two.

Arguments are passed by name and each function is given only the ones it asks for. `def evaluate(case)` and `def evaluate(case, params, submission, job)` are both fine. Asking for a name that is not on offer fails with the list of names that are.

| | `plan` | `evaluate` | `reduce` |
|---|---|---|---|
| `params` | yes | yes | yes |
| `job` | yes | yes | yes |
| `case` | | yes | |
| `submission` | | yes | |
| `results` | | | yes |
| `cases` | | | yes |

## Why a container per case

A submission that exhausts its memory, wedges its interpreter or spins forever takes its own container down and nothing else. One container for the whole evaluation would mean case three costing you cases four through forty, and a wall-clock limit generous enough for the entire suite, which is barely a limit.

It also puts a boundary between cases where progress can be written. A container reports nothing until it exits, so without the fan-out a competitor watching a ten minute evaluation would see nothing at all until it ended.

`plan` and `reduce` run with no submission in the container. A program that measures in `evaluate` and marks in `reduce` therefore never puts its benchmarks within reach of the code being marked.

## What `submission` is

The permitted files, on disk. The rest of the archive was discarded before the container started.

```python
submission.root              # where they are
submission.files             # the paths, relative to root
submission.path("a.py")      # one absolute path
submission.read("a.py")      # one file, as bytes
submission.copy_into("/app") # lay them over a directory
```

`copy_into` is what a competition whose image holds a harness wants: the files land on top of this container's copy of it, and the container is thrown away afterwards.

## Returning results

`evaluate` and `reduce` return a flat dict of scalars, because that is what a leaderboard row is. A board builds its columns from the top-level keys and stringifies anything else, so a nested dict arrives as JSON in a single cell with nothing to rank on. Returning one is an error naming the key rather than a quietly useless column.

Print whatever you like. Standard output and standard error both become the job's log, including anything a subprocess wrote, so a harness's own words reach the competitor unedited. The result does not travel that way and cannot be forged by anything the program starts.

## Configuration

| Key | |
|---|---|
| `program` | The program, inlined. `${{ text("./evaluate.py") }}` |
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

## Requirements

The image needs `python3` on its PATH and a writable `/tmp`. Nothing else: the shim uses only the standard library.

Install `sandbox/docker` alongside this, and mount the Docker socket into the runner service.
