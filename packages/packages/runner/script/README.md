# @open-competition-kit/runner-script

Evaluates submissions with a program the organiser writes, instead of with a package.

There is no shim and no adapter, so there is no list of supported languages. Your program reads one JSON file and writes another, which is something every language already does.

```yaml
with:
  - /packages/packages/standard
  - /packages/packages/runner/script

competitions:
  - id: sorting
    runner:
      command: ["python3", "evaluate.py"]
      include:
        evaluate.py: ${{ text("./evaluate.py") }}
```

```python
import json

req = json.load(open("/ock/request.json"))

value = None
if req["phase"] == "evaluate":
    value = {"score": len(req["submission"]["files"])}

json.dump({"ok": True, "value": value}, open(req["reply"], "w"))
```

That is a working competition, and those five lines of protocol are all of it. Everything below is for the ones that need more.

With no machine package installed, the command runs as a child process of the runner service, using whatever that service already has. That is enough to write an evaluation and score your own submissions this afternoon. It is not enough to score anybody else's: nothing is confined, and a submission can reach whatever the service can. Add `machine/docker` and an `image:` before you open the competition, and the same program runs in a container per case.

```yaml
with:
  - /packages/packages/standard
  - /packages/packages/machine/docker
  - /packages/packages/runner/script

competitions:
  - id: sorting
    runner:
      image: python:3.13-slim
      command: ["python3", "evaluate.py"]
```

## The three phases

The command runs three times, each as a run of its own:

| `phase` | when | answer with |
|---|---|---|
| `plan` | once, before anything | a list of cases, or `null` for one unnamed case |
| `evaluate` | once per case | a flat object of scores for that case |
| `reduce` | once, at the end | the leaderboard row, or `null` to have the numbers added up |

Answering `null` means you have no opinion about that phase, and the host fills in what it would have done. A competition that scores one thing therefore handles `evaluate` and ignores the rest.

`plan` and `reduce` run with no submission anywhere near them. A program that measures when it evaluates and marks when it reduces never puts its benchmarks within reach of the code being marked.

## The request

At `/ock/request.json`, every time:

```json
{
  "protocol": 1,
  "phase": "evaluate",
  "job": "cm...",
  "reply": "/tmp/ock-reply.json",
  "params": { "questions": ["q1a"] },
  "case": { "layout": "layouts/tinyMaze.lay" },
  "submission": { "root": "/ock/submission", "files": ["solver.py"] }
}
```

`case` is whatever your own `plan` put in the list, handed back untouched. `results` and `cases` appear on `reduce` and hold every case's answer alongside the case it came from. `params` is your `params:` block, unchanged.

Write the reply to the path `reply` names rather than hardcoding it. A protocol that moves the file later then moves it without touching your program.

## The reply

```json
{ "ok": true, "value": { "score": 4.5 } }
```

or

```json
{ "ok": false, "error": "the submission would not compile" }
```

`ok: false` fails that phase with your message. You do not have to catch anything, though: a program that throws leaves no reply behind, and the host reports the phase as failed with both output streams attached, which is where the traceback already is.

`value` for `evaluate` and `reduce` is a flat object of scalars, because that is what a leaderboard row is. A board builds its columns from the top-level keys and stringifies anything else, so a nested object would arrive as JSON in a single cell with nothing to rank on. Returning one is an error naming the key rather than a quietly useless column.

Print whatever you like. Both streams become the job's log, including anything a subprocess wrote, so a harness's own words reach the competitor unedited. The answer travels by file and cannot be confused with any of it.

## Why a run per case

With `machine/docker`, a submission that exhausts its memory, wedges its interpreter or spins forever takes its own container down and nothing else. One container for the whole evaluation would mean case three costing you cases four through forty, and a wall-clock limit generous enough for the entire suite, which is barely a limit at all.

It also puts a boundary between cases where progress can be written. A run reports nothing until it exits, so without the fan-out a competitor watching a ten minute evaluation would see nothing until it ended. That half holds whichever machine is installed.

## Configuration

| Key | |
|---|---|
| `command` | What to run, once per phase, from the work directory |
| `include` | The program and anything it reads, keyed by the path each lands at |
| `image` | The image every phase runs in, if the installed machine has images |
| `build` | A `dockerfile:`, optional `context:` and `args:`, built on startup instead |
| `params` | Passed to every phase untouched |
| `submission.allow` | Paths a submission may supply, as literals or globs |
| `timeoutMs` | Wall-clock limit for one phase |
| `limits` | `memoryMb`, `cpus`, `pids`, `network` |

There is no `program:` key. The program is a file like any other, and only `command:` decides which of them runs.

### Building the image

```yaml
build:
  dockerfile: ${{ text("./evaluate.dockerfile") }}
  args:
    HARNESS_REF: v2
```

Built when the runner service starts, and named after the contents of the recipe and its arguments. Editing the Dockerfile changes the name, and a changed name rebuilds. A fixed tag cannot do that, which is how a competition ends up scored against last month's harness with nothing anywhere reporting a problem.

A build has network access, since a recipe that installs anything needs one. The `machine:` ceiling governs runs, not builds. What protects you is where the inputs come from: the config, and never a submission.

A `build:` needs a machine that can build. Without one the runner service says so while preparing, at startup, rather than leaving it to be found as somebody's failed submission.

### Files the kit does not read

```yaml
include:
  evaluate.py: ${{ text("./evaluate.py") }}
  cases.yaml: ${{ text("./cases.yaml") }}
```

Copied in and never opened. This is how a project keeps its own list of instances, its scoring table or its reference outputs, without this package inventing a vocabulary for something it does not understand. Your `plan` reads the file; the kit only moves the bytes.

Anything here is readable by a submission while a case is being evaluated, because they share a run. Marking data that must not leak belongs somewhere a submission never gets to, which means a package rather than a program. Splitting measurement into `evaluate` and marking into `reduce` covers most of the gap, since `reduce` runs alone.

### The permitted files

```yaml
submission:
  allow:
    - solvers/*.py
    - agents/agent.py
```

Everything else in the archive is dropped before anything starts. Leave it out and the whole archive is taken, which is right when the submission is the answer and wrong when it overlays a harness. In the second case this is the only thing between a competitor and an edited marking script.

Patterns match by suffix, so the directory a GitHub archive wraps everything in never has to be named. `*` stops at a separator and `**` crosses them. A named file that is absent fails the submission, with every missing one reported at once; a glob that matches nothing is not an error.

## Requirements

A writable `/tmp` where the command runs, and whatever the first word of your `command:` needs. Nothing else.

For a competition with competitors in it, install `machine/docker` alongside this and mount the Docker socket into the runner service.
