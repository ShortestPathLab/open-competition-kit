# Splitting `standard`

`without:` exists because a default package can declare config fields, and a field
you did not ask for is one you cannot get rid of by installing something else.
That is a symptom. This is the cause and what to do about it.

## The rule the mechanics already imply

A package contributes two things, and they behave very differently under the
chain.

Behaviour is overridable by position. The last entry in `with:` is outermost, so a
package listed after another one is asked first, and an implementation that does
not call `next` replaces everything beneath it. Nothing an organiser installs is
stuck with somebody else's behaviour.

Config vocabulary is not overridable at all. `collectExtensions` gathers the
declarations of every installed package and `validateNode` accepts a key if any of
them claims it. There is no way to un-declare a field. Install a package that
declares `maxSubmissions` and `maxSubmissions` is a valid key, whether or not the
thing that enforces it is still in the chain.

So:

> A package may be a default only if it declares no config vocabulary.

Everything `without:` was invented for is a violation of that rule. Fix the rule
and `without:` stops being load-bearing.

## Reviewing what `standard` does

Six things, against the test of whether 99% of competitions want it.

**`enrolments.enrol`.** Creates the enrolment row for a user on a track,
idempotently. Every competition has people joining something. No policy in it, no
config. Bare minimum.

**`submissions.submit`.** Creates the submission row and a job to evaluate it.
Every competition that takes work takes it this way. The one-job-per-submission
shape is an assumption, but a near-universal one, and it is overridable by
position. No config. Bare minimum.

**`submissions.gate` and `status`.** The window, the attempt ceiling and the
rolling rate limit. This is policy, and it declares `opensAt`, `closesAt`,
`maxSubmissions` and `rateLimit` on a track. Plenty of competitions want none of
them, and an organiser gating through their institution's LMS wants the vocabulary
gone rather than merely inert. Not bare minimum.

**`leaderboard.loader`.** Computes rows from job outputs, and declares `from:` with
its `track`, `output`, `groupBy`, `select`, `rank` and `limit`. That is one
reading of what a leaderboard is, and its own doc comment says so. Competitions
exist with no leaderboard at all. Not bare minimum.

**`runner.run`.** Unzips the archive and `eval`s a JavaScript `body:` from the
config, declaring `body:` on the runner. This is a demo. The example project uses
`runner/script` instead, and the only config that uses `body:` is this
repository's own development one. Not bare minimum, and the most surprising thing
in the package. It was deleted rather than extracted: the unzip-and-`eval` was
only ever a way to prove the chain worked, and an organiser brings a runner
package.

**`machine.build` and `run`.** Starts a command as a child process of the runner
service, as the fallback nothing supersedes. It declares no config, deliberately:
the `machine` block's doc comment argues at length that the package doing the
confining should be the one declaring what it can be told, and this one confines
almost nothing so it says almost nothing. Passes the rule, but it is
infrastructure rather than business logic, and `db` and `files` are already
packages of their own.

## The split

| Package                   | Hooks                                    | Config                    | Default |
| ------------------------- | ---------------------------------------- | ------------------------- | ------- |
| `noop`                    | all, empty                               | none                      | yes     |
| `standard`                | `enrolments.enrol`, `submissions.submit` | none                      | yes     |
| `machine-local`           | `machine.build`, `machine.run`           | none                      | yes     |
| `gates-standard`          | `submissions.gate`, `submissions.status` | track: the four gate keys | no      |
| each leaderboard renderer | `leaderboard.loader`, `leaderboard.ui`   | leaderboard: `from:`      | no      |
| deleted                   | `runner.run`                             | runner: `body:`           | n/a     |

The rule partitions it exactly. Every default declares nothing, every opt-in
declares something, and there is no case that sits awkwardly between them. That is
usually a sign the line is in the right place.

What is left of `standard` is about sixty lines: create an enrolment if there
isn't one, create a submission and a job. Roughly 1,700 lines and 700 lines of
test move out.

Names and directories follow what is already there, where a package is
`area/impl`: `gates/standard`, and `machine/local` beside `machine/docker`.

## The leaderboard loader went into the renderers, not beside them

The obvious move was a `leaderboard-jobs` package holding the loader, with the
renderers unchanged. It is the wrong shape for an organiser. A leaderboard is one
feature to them, and installing a renderer that draws nothing until they find and
install a second package is a puzzle with no reward for solving it.

The relationship the split was protecting is real: several looks over one data
source is many-to-one, and duplicating the loader per renderer would be worse. So
the loader lives in `leaderboard/common`, which is a library rather than a
package. It never appears in a `with:` list and an organiser never learns it
exists. Each renderer imports it and re-exports both halves, so installing one
thing gives rows and something to draw them with.

Two consequences fell out of that.

`leaderboard.ui` had to stop being a `componentSource`. A component source takes
no arguments, so it cannot receive a `next` and cannot delegate, which meant the
last renderer listed took every board on the site. The only way to say "this board
looks different" was to install a different package at that board's own `with:`,
which is the package system answering a question config should answer. It is now
a chained lookup on a board's `kind:`, exactly like `surface.view`: each package
answers for the kinds it draws and passes the rest inward, and whoever answers for
the empty string supplies the default look.

Installing two renderers means `from:` is declared twice. That used to be a hard
error. It is now allowed, on the stated assumption that a field name has one
canonical definition: two packages may declare the same key, and the app only
refuses to start when they disagree about what a value there becomes. The
first-party packages agree because they all re-export the same declaration.
Third parties are encouraged to namespace, as `moodle:course`.

## One gates package rather than one per gate

Three arguments for splitting per gate, and I do not think they hold yet.

The precision argument does not apply. A gate is off unless it is configured, so
installing all three and using one costs nothing and hides nothing: a key you set
is a key that is enforced. The silent-setting problem comes from a package that
declares a field it does not enforce, which is not what is happening inside
`gates`.

The replacement argument mostly does not apply either. Gates are additive by
design, so a fourth gate needs no split to be added, and an institution with its
own attempt rule can install it and leave `maxSubmissions` unset, which makes the
built-in one inert.

The argument against is concrete. `standardRefusals` fetches the submission
history once and shares it between the attempts gate and the rate gate, and skips
it entirely when neither is configured. Its comment explains why that is not a
micro-optimisation: it runs on every submission and again every time a form
renders, and `Submission` carries no index on `(user, track)`. Split per gate,
each package fetches its own.

That is fixable, by memoising the history per request in the SDK, which already
depends on `p-memoize`. It needs a request scope the `kit` proxy does not
currently have. Worth doing eventually, and not worth blocking this split on.

So: one `gates-standard` package now, and revisit per-gate if somebody needs to
replace one specific rule and the memoisation exists.

## What this does to `without:`

After the split, no default declares a config field, so there is nothing a
`without:` can withdraw that ordering could not already handle.

The remaining reasons to reach for it are narrow. Replacing enrolment or
submission creation outright, which is overridable by listing your package later
anyway, so `without:` only saves you from having a dead link in the chain.
Avoiding a fetch for a package you will not run. And a fork published under a
different name, which the checkout rule cannot recognise.

That is the shape it should have had from the start: a last resort, not a step in
anybody's setup.

## Migration

Every existing config breaks, because `opensAt`, `from:` and `body:` stop
validating until the new packages are installed. The repository's own two configs
and the example project all used at least one of them.

The plan was a grace period: keep the new packages in the default list for one
release with a startup warning naming them, then remove them. That was not needed
in the end. Nothing outside this repository is running yet, so the three configs
were simply updated, and `from:` never left the default set at all because it
travels with a renderer an organiser was already installing. If that changes
before the first outside deployment, `migrate.ts` already models the warn-then-drop
shape.

Auto-adding a package because a config uses one of its keys would work and is
worse. A config that quietly installs things it does not mention is a config you
cannot read.

## Cost

Nothing imports `standard`'s internals. It has exactly one export, its default,
and `reference.std` lives in the SDK rather than here. So the split was moving
files, splitting `config.ts` up, and three new `package.json` files. The tests
moved with the code they cover.

One thing outside the split had to change with it. Turning `leaderboard.ui` into a
lookup broke `PropTypes<typeof $props.leaderboard.ui>` everywhere it was used,
because a chained lookup has no props for the type to read. Core now exports a
named `LeaderboardViewProps`, which is what `surface.view` already did for the
same reason.
