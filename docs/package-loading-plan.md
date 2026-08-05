# Package loading plan

Three changes to how a package gets named, fetched and run. They are written up
together because the second one subsumes half of the first, and the third one
constrains both.

## What is built

Stages 1 to 3 are done, minus the pieces listed under "What is left" at the end.
The wire protocol is deferred entirely and nothing depends on it.

One change to the plan turned up while building it. `form.submit`, `track.enrol`
and `runner.ui` were typed `S.Unknown`, supplied only by `noop` as `{}`, and read
by nothing at all. Typing them meant inventing a contract nobody had asked for, so
they are removed instead. [`extension.ts`](../packages/core/config/extension.ts)
already makes this argument about `auth`: advertising an extension point that
nothing reads is worse than not having one. Removing them breaks nobody, since
`decode` ignores an undeclared key either way, so a package still supplying one is
in exactly the position it was already in.

The order below is by retrofit cost rather than by value. The chain driver is
cheap today and gets more expensive with every package written against the
current `next` semantics, so it goes first even though nothing visible changes
when it lands.

## Where things stand

[`resolve.ts`](../packages/core/resolve.ts) takes a `with:` entry, resolves it
as a path against the directory holding the config file, and dynamic-imports it.
Anything starting with `https://` fails with `NotImplementedError`. The result is
memoised per process with `E.cachedFunction`, keyed on the raw specifier string.

That resolver is constructed twice, at
[`config/index.ts:109`](../packages/core/config/index.ts) and
[`hook/index.ts:213`](../packages/core/hook/index.ts). That means two memo caches
rather than two module instances: a dynamic import of the same absolute specifier
goes through the runtime's own module registry either way. So the duplication is
harmless today, and stops being harmless as soon as a loader owns a process, since
starting one is not something the module registry deduplicates.

`with:` reaches the rest of the system through two paths that both derive from
the root list: `walkNodes` seeds the validator and the config editor, and
`propagateExtendable` seeds the runtime hook lookup.

Hooks merge in [`hook/index.ts:199`](../packages/core/hook/index.ts). `mergeWith`
composes two functions into `(...args) => g(...args, f)`, so the later package
receives the earlier one as `next` and the last entry in `with:` ends up
outermost. Values that are not functions fall through to the default deep merge,
which is what keeps `form.submit`, `track.enrol` and `runner.ui` working.

A package is `DeepPartial<Hooks>` plus an optional `config` block of
`ConfigExtensions`.

## Stage 1: a chain driver instead of merge-time composition

`next` is currently a closure captured when the merge runs. That cannot survive a
process boundary, which is what a non-JS loader is. A Python `gate` handed a
`next` needs to reach a chain that may hold JS implementations on either side of
it, and a captured closure has no way to express that.

The fix is to keep the implementations in an ordered list per hook key and build
`next` at call time.

```ts
type Implementation = {
  /** Canonical URI of the package that supplied it. */
  source: string;
  invoke: (...args: unknown[]) => Promise<unknown>;
};

/** Outermost last, matching the order of `with:`. */
type Chain = Map<HookKey, Implementation[]>;
```

`OpenCompetitionKitHooks.get` keeps its signature and its return shape. Only the
construction changes: instead of folding the modules together with `mergeWith`,
collect them into a `Chain`, then synthesise the callable object by walking the
`Hooks` schema. For a key with implementations, the function it produces builds
`next` for link `i` as a call to link `i - 1`, and passes nothing at the
innermost link.

### Not every hook chains

`componentSource` is not composable, and [`hook/index.ts`](../packages/core/hook/index.ts)
says so where `surface.view` explains why it is a chained lookup instead: the merge
hands the later package's function the earlier one as an argument it ignores, so
the last package listed quietly takes the whole region.

Today that lands on the right answer by accident. A `componentSource` is a
zero-argument thunk, so the composed `next` arrives in a parameter slot nothing
reads, and last wins. A driver that treats every function leaf as a chain link
reproduces the same outcome and the same accident, and it also builds a `next` that
can never be called. Harmless in process. Not harmless later, when that `next` is a
value some loader has to make transportable.

So a hook declares its mode, and the two modes are `chained` and `override`.
`componentSource` produces `override`, where the last implementation wins outright
and no `next` is constructed. `hook()` produces `chained`. Both live on the schema
declaration, which is where the distinction is already documented in prose.

Two behaviours have to survive verbatim.

Non-function values still deep merge. The current customizer returns `undefined`
for them on purpose, which hands them back to `mergeWith`. The chain driver has
to do the same thing rather than treating every leaf as an implementation.

The merged object still goes through `decode(merged)`. A package that supplies a
hook of the wrong shape should fail at boot, and it will not if the driver hands
back a synthesised object nobody checks.

Nothing about this stage is visible from a package. That is the point: it is the
same semantics expressed in a form that a remote link can join later.

[`surface.test.ts`](../packages/core/surface.test.ts) already pins chain order.
Two tests are worth adding on top of it: three packages where the middle link
returns without calling `next`, and an assertion that `next` is `undefined` at
the innermost link, since `standard` relies on that in its `?? all` termination.

## Stage 2: package URIs, claimers and loaders

### Naming

A fully qualified package is `scheme:rest`.

```
local:./packages/packages/standard
npm:@open-competition-kit/standard@0.0.11
github:open-competition-kit/some-package@a1b2c3d
```

Without a scheme, the form of the name decides:

| Bare form           | Reads as              | Why it is unambiguous                        |
| ------------------- | --------------------- | -------------------------------------------- |
| `./x`, `../x`, `/x` | `local:`              | leading dot or slash                         |
| `@org/name`         | `npm:`                | npm is the only scheme with `@scope/`        |
| `org/name`          | `github:`             | npm has no unscoped names containing a slash |
| `name`              | built-in, else `npm:` | genuinely overlapping, see below             |

Only the last row is a real collision. A bare token is both a valid unscoped npm
name and the obvious spelling for a built-in alias, so built-ins get first refusal
against a closed set of names and everything else falls through to npm.

The other rows are decided by the predicate, not by the order they are tried in.
That distinction is worth keeping in the code, because an ordered list with
disjoint predicates gives a false impression of having handled ambiguity. When a
fourth claimer is added with an overlapping predicate, priority will silently pick
a winner. So the bare sweep collects every match and fails when there is more than
one, with built-ins as the single documented short circuit.

### Interfaces

```ts
type PackageRef = {
  scheme: "local" | "npm" | "github";
  /** Normalised, scheme-specific. A path, a package name, an org/repo. */
  id: string;
  /** Version, tag or commit. Absent means unpinned. */
  version?: string;
  /** The canonical spelling of the whole thing. */
  uri: string;
};

type Claimer<R = never> = {
  scheme: PackageRef["scheme"];
  /** Parses what follows an explicit `scheme:`. */
  parse: (rest: string) => Option<PackageRef>;
  /** Decides a bare specifier. None means not mine. */
  claim: (specifier: string) => Option<PackageRef>;
  /** Whatever it takes to end up with a directory on disk. */
  materialise: (ref: PackageRef) => Effect<string, ResolveError, R>;
};
```

`uri` does four jobs and is the reason `PackageRef` exists rather than passing
strings around. It is the memo key, the lockfile key, the text an error names, and
the `source` that [`describe.ts`](../packages/core/config/describe.ts) attributes
a field to.

Canonicalisation has to happen to the `with:` entries themselves, before anything
reads them, and not merely inside the resolver. `withAt` in
[`walk.ts`](../packages/core/config/walk.ts) deduplicates with `uniq` over raw
strings, so `./x` written at the root and `local:./x` written on a track survive as
two entries. A resolver memo keyed on the canonical form then returns the same
module twice, and the package appears twice in the chain and twice in the config
extensions. Normalise in the same step that applies the defaults, which is the one
place both `walkNodes` and `propagateExtendable` read from.

`materialise` is where the schemes stop resembling each other. Local resolves a
path and returns it. The other two fetch, unpack, install dependencies and return
a cache directory. `standard` alone needs `jszip`, `zod`, `js-yaml` and the SDK
present before it will import, so "fetch the package" is not the whole job.

### Loading

Acquisition and loading are separate axes and the scheme must not pick the
loader. `github:org/repo` is as plausibly Python as JavaScript, and `npm:` is only
a JS smell by convention. Welding the two together puts the package author's
implementation language into the organiser's config, where it does not belong and
where it would have to be edited if the package were ever rewritten.

So the loader is chosen from the materialised directory:

```ts
type Loader<R = never> = {
  id: string;
  /** Can I load what is in this directory? */
  claim: (dir: string) => Effect<boolean, never, R>;
  /** Start it. Owns whatever process or runtime it needs. */
  start: (dir: string, ref: PackageRef) => Effect<Loaded, LoadError, R>;
};

type Loaded = {
  /** Fully native. Whatever conversion was needed has already happened. */
  package: Package;
  stop?: () => Effect<void>;
};
```

Selection reads a manifest at the package root:

```json
{ "runtime": "js" }
```

`js` is the only legal value for now. A package with a `package.json` and no
manifest is assumed to be JS, so nothing that exists today needs editing. Python
later adds `{ "runtime": "python", "entry": "package.py" }` and a second loader,
with no change to the claimers.

### Every hook crosses, once the awkward values have somewhere to go

[`files.ts`](../packages/core/hook/files.ts) and
[`machine.ts`](../packages/core/hook/machine.ts) both say their hooks cannot cross
a language boundary. Read as a statement about the payloads that is narrower than
it sounds. Only three things in the whole of `Hooks` are actually stuck, and each
one has a solved analogue already in the repo.

Unbounded byte sequences. `files.read` returns a `ReadableStream<Uint8Array>` and
`files.write` takes a `FileBody`.

Large bounded blobs. `machine.run` takes `files?: Record<string, Uint8Array | string>`
and returns `files: Record<string, Uint8Array>`. Base64 inside a JSON envelope
costs a third again in size and a full copy on both sides, per run.

One `Date`. That is the entirety of what blocks `db`. Its hooks take
`{ collection, payload }` and return a row, and rows are built from `String`,
`Number`, `Boolean`, `Json` and `CreatedAt`. Only the last of those is not already
JSON, and [`config/schema.ts`](../packages/core/config/schema.ts) solves the same
problem with `Timestamp` for almost the same reason.

Nothing else is stuck. `runner.run`, `setup` and `teardown` take `{ job: string }`
and do their real work through `kit.*`. The gates take and return records built
for display. `leaderboard.loader`'s return type is annotated serialisable because
it already crosses to the browser. Even the UI hooks are fine: `componentSource`
types a thunk returning `{ type, source: string }`, which is source text, not a
component.

Three hooks cannot be judged at all, because they are typed `S.Unknown`:
`form.submit`, `track.enrol` and `runner.ui`. Give them real types as part of this
work rather than after it. They are the only places where nobody can say what
crosses, and the question is cheapest to answer while it is being asked.

### The loader converts, and nothing else knows

`Loaded.package` is contracted to be fully native. That one line does most of the
work here, because it puts every conversion inside the loader and leaves the rest
of the system unable to tell the difference.

Between two links in a chain nothing is converted, since both sides are already
native. At a foreign link the loader's wrapper converts arguments on the way in
and results on the way out. The chain driver from stage 1 is untouched, `Hooks`
keeps the signatures it has today, and no existing package changes. For the
in-process JS loader the conversion is the identity function, so the path that
runs now costs nothing it did not already cost.

How a subprocess loader gets from a Python return value to a real
`ReadableStream` is entirely its own business: chunk messages up the channel, a
fifo, a staging file, chosen by size or by whether it happens to share a
filesystem with the host. None of that reaches an interface.

The precedent is already here. `FileRef` in [`file.ts`](../packages/core/file.ts)
is a JSON-safe pointer to bytes living somewhere else, which is what lets a
submission reference two gigabytes without the row carrying them. `FileBody` is
already a union of five representations, and `machine.build` already takes
`context` as a host path. A loader that wants a pointer form has models to copy.

One conversion is worth naming up front because it is not the loader's discretion:
an instant. `db` rows carry `CreatedAt`, which is `S.DateFromSelf`, so a foreign
implementation has to hand back a string. That is not a formatting detail.
[`gates/standard/gates/rate.ts`](../packages/packages/gates/standard/gates/rate.ts) calls
`submission.createdAt.getTime()`, so a row arriving with a string where a `Date`
belongs fails inside a different package from the one that produced it. A foreign
loader therefore owes rehydration rather than serialisation, and it needs a tagged
form to rehydrate from.

Which is why the inventory above is a lower bound and not a finding. `db.Json` is
`S.Any` and the `db` hooks return `unknown`, so nothing in the type system holds
anyone to it. Establishing what genuinely crosses means narrowing those types or
specifying tagged codecs, and both belong with the protocol rather than in front of
it.

### What this deliberately leaves out

Two things a reader will expect to find here are absent on purpose.

There is no enum of transports on the loader, naming the ways a value can be
moved. Such an enum wants four members and survives none of them. A handle is a
chunk message or a `kit.*` callback, both of which the protocol below already has.
Native is not a way across a boundary, it is the absence of one. A shared
filesystem path is an optimisation over chunking rather than a capability, since
anything movable as a path is movable as chunks at the cost of a copy. That leaves
one member, and a one-member enum is not a concept worth an interface.

There are also no widened `files` and `machine` signatures. A `Bytes` union that
lets a hook accept a path or a pointer instead of the actual bytes only earns its
place for a package that would rather not have two gigabytes pulled through its
memory. Making that work along a whole chain means the kit understands the union
well enough to pass it between links unconverted, which is the negotiation
machinery again, reintroduced for a saving nobody has measured. Widen the one
signature that needs it when a package asks, and pay for the pass-through then.

`excludes` on the loader survives as a plain list because it costs nothing and
needs no taxonomy. It is expected to stay empty.

Two consequences worth stating plainly. There is no load-time capability check,
because with conversion inside the loader nothing is left that cannot cross, and a
check with nothing to reject is ceremony. And stage 2 no longer touches `Hooks` at
all, which takes a good deal of risk out of it.

`next` needs no rule of its own either. It carries the same signature as the hook
it belongs to, so whatever the request and response can do, `next` can do in the
other direction.

### The wire protocol

Deferred. Not part of this work, and nothing below is being built.

It is written down because the rest of the plan has to leave room for it, and
because the shape it will take is the reason several decisions above went the way
they did. Every loader shipped here is in-process and converts nothing, so the
question of how a value crosses a boundary does not arise yet.

A loader can only absorb what the earlier sections describe if the wire underneath
it is capable enough. Request and response is not: two messages, so anything that
is not a value has to be smuggled through a side channel, and every side channel is
a mechanism somebody has to invent, document and negotiate.

Bidirectional message passing removes the side channels. One envelope, both
directions, multiplexed on an invocation id:

```
host  -> guest   { id, type: "invoke", hook: "submissions.gate", args }
guest -> host    { id, type: "call",   path: ["tracks", "get"], args }
host  -> guest   { id, type: "result", value }
guest -> host    { id, type: "next",   args }
host  -> guest   { id, type: "result", value }
guest -> host    { id, type: "chunk",  stream: "s1", data }
guest -> host    { id, type: "return", value }
```

`next` becomes a message. A `kit.*` callback becomes a message. A stream chunk
becomes a message. Progress on a long runner job becomes a message, which is
wanted anyway. Request and response is then the degenerate two message case rather
than the thing everything else has to be bent around.

The guest side of this is one client, not two, because
[`sdk/kit.ts`](../packages/sdk/kit.ts) already dispatches on a path and an
argument list and answers with `{ value, error }`. The host to guest direction is
the same envelope with a hook name in place of a path.

Length-prefixed frames over stdio is the obvious framing for a subprocess and has
plenty of precedent in tools that do exactly this. Allow a frame to be raw bytes
rather than JSON, so a chunk message does not pay for base64. This is also the
piece not to retrofit, since every guest SDK is written against it.

The sketch above is a sketch, and the gap between it and a specification is most
of why this is deferred. It does not answer nested correlation when a guest issues
a `call` while a `next` is outstanding, error propagation, cancellation, stream
start and end, host to guest chunks (which `files.write` and `machine.run` both
need, so binary has to travel in both directions), backpressure, or what a chain
does when a guest dies mid-call. That last one should fail the call rather than
behave like a package that declined to participate, which is the silent failure
[`validate.ts`](../packages/core/config/validate.ts) already works to avoid
elsewhere. None of these has an obvious default, and answering them badly is worse
than answering them late, because every guest SDK is written against the answer.

When it is picked up, a test-only loader that is in-process but pretends not to be
is the thing to build first: it runs every argument and result through the
protocol, converting each way as a subprocess loader would, and drives the existing
package test suites unmodified. That is the cheapest available proof the design
holds, and it does not depend on a Python loader existing.

### What keeps the door open

With the protocol deferred, these are the properties the rest of this work has to
preserve. Each one is cheap now and expensive to retrofit.

`Loaded.package` is native. A future loader converts internally and nothing else
in the system learns that it did.

The chain driver builds `next` at call time from an ordered list, and honours hook
modes. An out-of-process link cannot join a chain assembled by closure capture.

The loader is chosen from the materialised directory rather than the URI scheme,
so acquisition and language stay orthogonal.

The manifest names a runtime. A Python package is identifiable before a Python
loader exists, which is what lets the stub refuse it by name.

The loader owns `start` and `stop`, and one registry owns the loaders. A future
subprocess needs somewhere to live and something to shut it down.

`kit` keeps its path plus arguments to `{ value, error }` shape, since that is the
guest API for free.

`ConfigExtension.schema` stays typed as `StandardSchemaV1` rather than as a Zod
schema, so a non-JS package can ship a declarative schema and have its loader adapt
it.

`stop` exists because `surface.content` is called while a page renders and is
documented as needing to be cheap. A subprocess per call is not viable there, so a
loader starts once and lives as long as the process does.

Which means `stop` needs an owner, and a loaded package needs to be a
process-wide singleton rather than a per-caller one. Config validation, config
description and hook execution each reach for a package independently today, and
each builds its own resolver to do it. Memoised imports make that harmless now.
Memoised process startup does not exist, so the same package would be started once
for its config schemas and again for its hooks, with nothing holding either handle
and nothing to call `stop` on at shutdown.

So the registry is not a tidier version of the two resolvers, it is the thing that
makes the loader interface implementable: one place that memoises materialisation
and start against the canonical URI, hands out the same `Loaded` to every caller,
and shuts them all down together. Building it while both callers are still doing
nothing but importing modules is much easier than retrofitting it around a running
subprocess.

### What already works in our favour

Three boundaries would normally have to be crossed for a non-JS package and two
of them are already crossed.

`Source` in [`hook/component.ts`](../packages/core/hook/component.ts) is
`{ type, source: string }`. UI hooks return source text, not component
references, so a non-JS package emitting a UI is not blocked at the type level.

`kit` in [`sdk/kit.ts`](../packages/sdk/kit.ts) is a `DeepProxy` dispatching on
`this.path` with an argument list and returning `{ value, error }`. That is an RPC
envelope already. A Python SDK is a client for the existing shape rather than a
second API to design and keep in step with the first.

The third is config extensions, and it needs a decision.
[`extension.ts`](../packages/core/config/extension.ts) types a schema as
`StandardSchemaV1`, declared as an interface rather than depended on. That is
already vendor-neutral on the JS side, which means a non-JS loader can ship a
declarative schema (JSON Schema is the obvious pick) and adapt it into a
`StandardSchemaV1` object when it starts. Core needs no change at all. Write this
down somewhere durable, because the tempting simplification is to retype
`ConfigExtension.schema` as a Zod schema, and that closes the door.

### Cache, pinning and prefetch

The cache is keyed on the canonical URI plus the resolved version, so two
competitions on one host share a package and a version bump does not evict the old
one mid-run. That is name addressing, not content addressing, and calling it the
latter would be a claim the design does not support. Content addressing needs a
digest of the artifact, which is a reason to record one rather than a reason to
avoid the word.

Pinning is supported from the first release. Parsing a version off a scoped npm
name means splitting on the last `@` rather than the first, which is easier to get
right before there are configs in the wild than after. Resolved versions go in a
`competition.lock.json` beside the config, along with an artifact digest and the
resolved transitive dependencies, because a pinned package whose own dependency
range floats is not pinned in any sense that matters to a competition.

The example config already argues this point in a different register: the
evaluation image is named after the hash of its recipe precisely so a competition
cannot be scored against a harness that changed underneath it. A floating package
version is the same failure with more surface area.

Fetching happens in an explicit install step, not at boot. At boot the resolver
reads the cache and fails loudly when something is missing, naming the URI and the
command that would fix it.

Failing loudly needs somewhere to fail from, and today there is nowhere.
[`validate.ts:80-89`](../packages/core/config/validate.ts) catches a resolver
failure and treats the package as contributing no config fields, on the reasoning
that a broken integration is not a broken competition. Correct for its purpose, and
it means a package missing from the cache that happens to declare no config fields
gets through config loading untouched and surfaces much later, during a hook
lookup, as a chain that is quietly one link short. So the install check is a
preflight of its own: resolve every entry once, before validation, and report all
the missing ones together. Config validation keeps its current forgiving behaviour,
because by the time it runs the question has already been answered. Lazy fetch is a fine developer convenience and a bad
production default: a UI service that will not start because a registry is having
a bad morning takes a live competition down for a reason that has nothing to do
with the competition. The `runner.prepare` hook exists for the same reason.

### Failure behaviour

[`validate.ts:80`](../packages/core/config/validate.ts) already distinguishes a
package that failed to import from one that loaded and declares no config, so an
unrecognised field can blame the missing import instead of the organiser's
spelling. Keep that channel and give it a reason: not in cache, version mismatch,
install failed, no loader claimed the directory.

The tests worth writing here are table driven parse cases over every bare form,
including a scoped name carrying a version; an assertion that two spellings of one
local path collapse to a single canonical URI and a single cache entry; and a fake
claimer paired with a fake loader that exercise materialise and start without
touching the network.

### Check this before starting

Confirm the Nitro build tolerates importing a package from a runtime cache path.
The SDK is marked external for both rollup and SSR in
[`vite.config.ts`](../packages/services/ui-service/vite.config.ts), so packages
are already imported by the server process rather than bundled, and the assumption
is that an arbitrary absolute path behaves the same way. If it does not, stage 2
changes shape, and that is much cheaper to discover now than halfway through.

## Stage 3: built-in default packages

`noop` and `standard` apply without appearing in a top-level `with:`.

The defaults are canonical URIs, which is why this stage sits after stage 2:
`npm:@open-competition-kit/noop` resolves out of the cache, and the dependency
cycle that blocks it today never arises. Core cannot depend on `noop` and
`standard` directly, because both depend on the SDK which depends on core, and
[`publish.sh`](../publish.sh) publishes strictly dependencies first with exact
versions pinned from the lockfile.

Written unversioned, they are also the one case where an unpinned entry is not the
organiser's decision to make, since they never wrote it. So the defaults are
pinned like everything else: the version core ships with is what goes into the
lockfile on first install, and it moves when the lockfile moves. A default that
floats would mean an organiser's competition changing behaviour on a package they
cannot see in their own config.

The list is applied in one place: the root node's `with`, as a step in the `raw`
pipeline in [`config/index.ts`](../packages/core/config/index.ts) between
`migrate` and `transform`. Everything downstream derives from the root list, so
validation, the config editor, the runtime chain and the resolver memo all agree
without a second mechanism. After `migrate` so a renamed key is already current.
Before `decode` so `Extendable`'s absent-to-`[]` default still applies and the
value is a plain string array throughout. Nothing writes config back to disk, so
there is no risk of the defaults being saved into somebody's file.

The alternative of patching `withAt` in [`walk.ts`](../packages/core/config/walk.ts)
covers the validator and the editor but not `propagateExtendable`, which is what
the runtime chain reads. That would leave two copies of the same list, which is
the duplication the walk.ts header exists to argue against.

Defaults prepend. The last entry in `with:` is outermost, `noop` has to stay
innermost to terminate the chain, and `standard` has to stay inside anything the
organiser installs so their packages can wrap it.

Dedupe by filtering the defaults against the authored list, not by `uniq` on the
concatenation. `uniq` keeps the first occurrence, so an organiser writing
`with: ["local:./mine", "npm:@open-competition-kit/standard"]` to deliberately put
`standard` outside `mine` would have it snapped back to the default position with
no complaint. Filtering makes an explicit mention the way to re-position a default.

Removal gets a root-only `without:` list, added to `Config.fields` so
`CORE_KEYS.root` picks it up with no further work. A boolean would force anyone
dropping `standard` to re-list `noop` by hand, and replacing the standard workflow
while keeping the empty chain terminator is the case worth supporting. An entry
in `without:` naming something that is not a default is a typo and fails at boot,
consistent with how every other unrecognised key behaves.

Two documentation changes follow. The "How `with:` propagates" section of
`open-competition-kit-docs/docs/extending/configuration.md` currently tells
organisers that `noop` goes first in most configurations, and the `with:` lists in
both `competition.config.yaml` files stop being the full picture.

## Not in scope

No wire protocol, and therefore no loader that crosses a process. Stage 2 ships the
in-process JS loader plus a stub loader for a non-JS runtime whose every function
raises not-implemented. The stub is not a placeholder for its own sake: it is what
proves the registry, the manifest and the selection path work for a runtime that
is not JavaScript, and it turns "your Python package cannot run yet" into an error
that names the package instead of a resolver failure that names a file.

No conversion layer, no carriers, no codecs. Every loader here is in-process and
hands values through untouched, so the instant problem and the tagged-codec
question both arrive with the protocol.

No changes to `Hooks`, apart from typing the three that are `S.Unknown` and giving
each hook a mode.

No `https://` claimer. It stays `NotImplementedError` until somebody asks for it.

No extension point for the `auth:` block. It is parsed in the UI service and there
is no auth package to move it to, so adding a node kind for it would advertise
something nothing reads.

## What is left

Fetching is delegated to `bun add`, run inside a cache directory per package.
Writing a package manager in order to avoid running one would be a strange trade,
and it means resolution, integrity and the transitive tree are handled by the tool
every service already runs on. What is recorded beside each cache entry is the
mapping from a canonical uri to what bun resolved.

That leaves the lockfile. Bun writes one inside each cache directory, which pins
the tree, but there is no single file beside the config recording what every
package resolved to, and no artifact digest. Until there is, a fresh install on a
new host can resolve a floating range differently from the one that is running.
The install record is the shape that file wants to be built from.

The defaults are also unpinned, for the same reason: they are written as
`npm:@open-competition-kit/noop` with no version, and the version they land on is
whatever the install step resolved on that host.

Nothing has exercised `github:` against a real repository. The specifier bun is
given is `github:org/repo#ref`, which bun documents, and the installed directory
is discovered by reading what appeared in `node_modules` rather than by guessing
the name, but that path has not been run.

The spike about importing from a runtime cache path was answered by the deployment
that already exists rather than by an experiment: the example project's config
names `/packages/packages/noop`, an absolute path outside any `node_modules`, and
the image imports it today. The cache is another absolute path. `npm:is-number`
has since been fetched into a cache and imported through the registry, which is
the same mechanism.

## Open questions

Does an unpinned `npm:` or `github:` entry warn or fail? Failing is consistent
with how the rest of the config treats ambiguity, but it makes the first five
minutes with the tool worse.

Where does the cache live? Beside the config is easy to reason about and easy to
delete. A shared location per host avoids re-downloading the same package for
every competition on it.

Does `describe` show built-in defaults as installed packages? An organiser reading
their own config never wrote them, but a config editor that hides where `opensAt`
came from is worse than one that shows a package nobody typed.
