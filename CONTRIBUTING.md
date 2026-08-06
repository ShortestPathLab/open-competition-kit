# Contributing

## Getting set up

```bash
bun install
bun test
```

You need Bun. Postgres is only needed to run the services, not to run the tests,
which is deliberate: a test that needs a database is a test nobody runs.

```bash
docker compose up db     # Postgres on 5433
bun run db:prisma:generate
```

The development configuration is `competition.config.yaml` in the root. It is
gitignored, so copy it from someone or write your own. Every `with:` entry in it
should point at the working tree, since an entry without a scheme resolves as an
npm package and would fetch a published copy instead of the code you are editing.

## Before you open a pull request

The same four things CI runs:

```bash
bun test
bash ./tsc.sh
bun run lint
bun run format
```

`tsc.sh` runs `tsc` once per package and prints `Failed:` rather than stopping, so
that one broken tsconfig does not hide the other eighteen. Read the output; a zero
exit code does not mean it passed.

## How the code is arranged

- `packages/core` is the engine: config loading and validation, the package
  registry and chain, and the hook definitions. It depends on no package.
- `packages/sdk` is the interface a package author writes against. It wraps core's
  Effect-based API in plain async functions.
- `packages/packages/*` are the published packages, one directory per npm name.
- `packages/services/*` are the two containers: the site and the job runner.

Core cannot import a package and a package cannot import core directly, only
through the SDK. That is what keeps `publish.sh` able to publish in dependency
order.

## Writing a package

A package is a `package.json` and a default export satisfying `Package`. Implement
the hooks you care about and leave the rest out; anything you do not answer falls
through to the next package in the chain.

Two things are worth knowing before you add one:

**Behaviour is overridable, vocabulary is not.** A package later in `with:` is
asked first and can replace what is beneath it. Config fields work the other way:
every installed package's declarations are merged and there is no way to
un-declare one. So a field you add is a field every configuration that installs
you has to live with forever. This is why the default packages declare none.

**Chained hooks take a `next`.** Call it to let the packages beneath you answer,
or do not call it to replace them. A hook that ignores `next` and returns its own
value is a valid and sometimes correct thing to write, but say so in a comment,
because it is invisible from the config.

There is a walkthrough in the
[documentation](https://shortestpathlab.github.io/open-competition-kit-docs/extending/).

## Commit messages

Conventional commits, scoped to the area:
`feat(ui-service):`, `refactor(core):`, `fix(runner-script):`. Append `!` for a
change that breaks a package written against the previous behaviour, which
includes any change to a hook signature.

## Releasing

`./publish.sh [patch|minor|major]` bumps every package, refreshes the lockfile so
the workspace pins are right, and publishes in dependency order.

Both halves matter. `bun publish` rewrites `workspace:*` to an exact version taken
from the lockfile, so bumping and publishing one package at a time ships every
dependent pinned to the previous release. And publishing a dependent before its
dependency puts a package on the registry that names a version nobody can install.
The CI workflow runs the same list one job at a time for the same reason.

Tag the release as `v<version>` to publish from CI.
