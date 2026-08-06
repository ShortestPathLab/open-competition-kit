# Open Competition Kit

Run a programming competition from a YAML file.

You describe the competition: what it is called, who can enter, what a submission
looks like, how it is scored, what the leaderboard shows. The kit gives you a
site where competitors sign in, enrol, submit, and watch their standing, plus an
organiser dashboard behind it. Everything the kit does not decide for you comes
from a package you install, so the parts you care about are swappable and the
parts you do not can be left alone.

Documentation: <https://shortestpathlab.github.io/open-competition-kit-docs/>

## What a competition looks like

```yaml
with:
  - "npm:@open-competition-kit/db-prisma@0.0.11"
  - "npm:@open-competition-kit/form-json@0.0.11"
  - "npm:@open-competition-kit/large-files-local@0.0.11"
  - "npm:@open-competition-kit/leaderboard-ag-grid@0.0.11"

name: My Competition
description: A programming competition.
admins: [you@example.com]

db: { provider: postgresql, url: postgres://postgres:postgres@db:5432/postgres }
files: { root: /data/files }
auth: { email: {} }

competitions:
  - id: first
    name: My First Competition
    tracks:
      - id: main
        name: Main Track
        form:
          shape:
            - { id: entry, name: Your submission, kind: file }
    runner: {}
    leaderboards: []
```

Fetch the packages, then start the services:

```bash
bun run packages:install
docker compose up
```

Packages are never fetched while a service is booting. A registry having a bad
morning should not be able to take down a competition that is already running, so
the install step is separate and a missing package is named at startup rather than
downloaded.

## How it fits together

Two services and a database. The UI service serves the site and the dashboard;
the runner service takes jobs off the queue and evaluates them. Both read the
same `competition.config.yaml` and the same database, and neither has any
competition logic of its own.

The logic lives in packages. Each one implements some of a fixed set of hooks,
and the `with:` list is the chain: the last entry is asked first and may either
answer or pass the call inward. That is how a competition swaps out how
submissions are stored, where they are evaluated, what a leaderboard is, or what
counts as a valid entry, without forking anything.

| You want to change               | Install a package implementing |
| -------------------------------- | ------------------------------ |
| Where rows are stored            | `db`                           |
| Where uploaded bytes go          | `files`                        |
| What a submission form is        | `form`                         |
| Who may submit, and when         | `submissions.gate`             |
| How work is evaluated            | `runner`                       |
| Where evaluation runs            | `machine`                      |
| What a leaderboard shows         | `leaderboard`                  |
| What a package can say in the UI | `surface`                      |

The catalogue of published packages is in the
[documentation](https://shortestpathlab.github.io/open-competition-kit-docs/packages/).
Writing your own is a `package.json` and a default export.

## Reproducibility

A `with:` entry carries its own version, and that is the whole pinning mechanism.
`npm:@scope/thing@1.2.3` and `github:org/repo#<commit>` each name exactly one
artifact, so two hosts given one config run the same code. There is no lockfile
to keep alongside the config, and nothing to reconcile.

`bun run packages:install` reports every entry that is not pinned and prints the
spelling that would pin it, using whatever it resolved to just now. Set
`OCK_REQUIRE_PINNED=1` to make an unpinned entry fail the install instead, which
is what a deployment that has to be able to explain its results later wants.

## Working on the kit

```bash
bun install
bun test
bun run lint
bun run format
bash ./tsc.sh          # every package's tsconfig, one at a time
```

The repository is a Bun workspace. `packages/core` is the engine, `packages/sdk`
is what a package author writes against, `packages/packages/*` are the published
packages, and `packages/services/*` are the two containers.

`competition.config.yaml` in the root is the development configuration and is
gitignored. It points every `with:` entry at the working tree, because an unnamed
default resolves as an npm package and would be fetched rather than being the code
you are editing.

To run the whole thing locally against the example competition, see
[open-competition-kit-example-project](https://github.com/ShortestPathLab/open-competition-kit-example-project).

## Status

Pre-1.0. The hook signatures are the public API for anyone writing a package, and
they have changed with a `!` on the commit more than once. They will settle at
1.0.

Editing configuration from the organiser dashboard is a preview. It writes real
changes to your config file, and it does not yet cover everything the file can
express: tracks, leaderboards and the package list are read-only there and are
edited in YAML.

## Licence

MIT. See [LICENSE](LICENSE).
