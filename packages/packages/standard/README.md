# @open-competition-kit/standard

`@open-competition-kit/standard` implements the default competition workflow for Open Competition Kit. It creates enrolments, records submissions, opens pending jobs, resolves submitted source archives from job context, and runs the configured competition runner while writing job outputs and statuses back into the kit.

Open Competition Kit is a modular toolkit for running programming competitions. A competition is described in `competition.config.yaml`, then extended with packages that provide storage, submission forms, enrolment behavior, runners, integrations, and leaderboards.

To use the standard workflow package, add it to your `competition.config.yaml`:

```yaml
with:
  - "@open-competition-kit/standard"
```

This package expects another package or integration to place submission source code into job context under the standard source-code zip reference. The GitHub classic integration does that by downloading the selected repository ref before the runner executes.

## The local machine

A runner that evaluates by running a command needs a machine to run it on. This package provides the one you get when you have not chosen: it starts the command as a child process of the runner service and hands back what it printed.

That is enough to write an evaluation and score your own submissions the same afternoon, without a Docker socket, an image or a second package. It is not enough to accept anybody else's code. Nothing is confined: the memory, CPU and process limits a runner asks for are ignored, `network: false` is ignored, and the command can read whatever the runner service can read. The wall-clock limit is real, and is the only thing here protecting the queue from a program that hangs.

Two more things follow from running on a host rather than in a container. Runs are queued one at a time, because a container gets its own filesystem and a host does not, and two evaluations writing their request to the same path would score each other's work. And a `build:` recipe or an `image:` is refused rather than ignored, because a competition scored in the wrong image looks exactly like one scored in the right image.

Install `@open-competition-kit/machine-docker` and the same runner gets a container per case, with the limits applied. Nothing else about the competition changes.

## Leaderboards

This package also implements `leaderboard.loader`, which is what turns job
outputs into leaderboard rows. Without a loader, a board has no data — the
renderer packages (`leaderboard-ag-grid`, `leaderboard-card`,
`leaderboard-chart`) only draw whatever rows they are handed.

Declare where a board's rows come from with `from:`:

```yaml
leaderboards:
  - id: main-track-leaderboard
    name: Main Track Standings
    from:
      track: main # omit to include every track in the competition
      output: default # which job output to read (default: `default`)
      groupBy: user # user | submission | job | none  (default: user)
      select: best # best | latest                    (default: best)
      rank:
        field: score # what `best` means, and how rows are ordered
        order: desc # desc | asc  (asc when lower is better, e.g. elapsed time)
      limit: 10 # keep the top N
    shape:
      - id: rank
        name: Rank
        kind: number
      - id: user
        name: Competitor
      - id: score
        name: Score
        kind: number
```

Omit `from:` and the board falls back to the literal `items:` you write in the
config — useful for a static or placeholder board.

### How a row is built

Every job that has finished (any status that is not pending/running/failed)
contributes the output stored under `from.output`. That output is flattened into
a row and merged with the job's metadata, so these columns are always available
to `shape:` even if your runner never emits them:

`user`, `userId`, `submission`, `job`, `track`, `status`, `submittedAt`, `ranAt`

A runner's own fields are applied last and win, so emitting a `user` key
overrides the default one.

Outputs may be a scalar (becomes `{ value }`), an object of scalars (becomes one
row), or an **array** (becomes one row per element — which is how a runner that
evaluates a submission against N test cases reports per-case results). Nested
values are JSON-stringified rather than dropped.

`rank` is filled in automatically after ordering, unless your runner supplied it.

### What your runner has to emit

For the config above, the runner must write a `score` onto the job output:

```ts
await outputs.set({
  owner: job,
  reference: "default",
  value: { score: 91.2, elapsed: 1210 },
});
```

That is the whole contract between a runner and a leaderboard.

For contributors, set up the repository from the monorepo root:

```bash
git clone https://github.com/open-competition-kit/open-competition-kit.git
cd open-competition-kit
bun install
```
