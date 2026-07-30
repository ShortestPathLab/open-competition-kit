# UI surfaces: design

**Status: implemented.** Packages can contribute content to named regions of the
product, and `integration/github-classic` uses it.

- the content vocabulary, the region catalogue, and the ordering rules:
  `packages/core/surface.ts`
- the two hooks: `surface.content` and `surface.view` in
  `packages/core/hook/index.ts`
- the helpers a package writes against: `surfaces()` and `views()` in
  `packages/sdk/surface.ts`
- the host: `src/lib/surface-fn.ts` and `*/components/surface-slot.tsx` in the UI
  service, with the renderer lookup generalised in
  `src/hooks/use-kit-component.tsx`
- the first real contributions, including one bundled view:
  `packages/packages/integration/github-classic`

## The problem

A package could act on the product but not speak to it.

`integration/github-classic` creates a repository during enrolment, grants the
competitor push access, and populates their branches into the submission form.
Nothing anywhere said so. The enrol page fired a toast and navigated away, the
competition rail had no room for a repository link, and a submission's detail page
showed a ref buried in its raw JSON body.

The pages where those things belong cannot fix this themselves. The competition
rail should not know what a repository is, and an organiser who installs no
integration should not have a panel with a hole in it.

Neither existing extension point covers it either. `hook<In, Out>()` chains
actions, and there was no action to hook. `componentSource` delivers a React
component, but component sources do not compose: `mergeHooks` builds
`(...args) => g(...args, f)`, and a component source takes no arguments, so the
last package listed silently takes the whole slot. That is the right behaviour for
`form.ui` and `leaderboard.ui`, where one renderer per form is the point. It is
useless for content that several packages may add to at once.

## The shape of the fix

Contributions are serialisable data by default, addressed at named regions, and
drawn by the host in the host's own design. A bundled component is available where
data is genuinely not enough.

The precedent is `submissions.gate`. A package contributes `Refusal` records, core
aggregates them, and the browser renders them with app components. This is the
same arrangement for the other half of the conversation: the gate refuses and
explains why, a surface tells a competitor something useful without standing in
their way.

### 1. Regions

A region id is namespaced under a stem, the way a job output reference is:

```ts
export const region = <T extends string>(name: T) => `${stem}/${name}` as const;

std.competitionYou; // "open-competition-kit/surface/competition/you"
```

`packages/core/surface.ts` holds the ids the shipped UI asks about, and a
`Subjects` map records what each one is about. A contributor to `enrolment/done`
is always told which enrolment, so it does not have to check.

The nine regions today: `competition/you`, `competition/overview`,
`track/detail`, `enrolment/done`, `submission/new`, `submission/detail`,
`job/detail`, `me/overview`, `dashboard/overview`.

On the wire `surface` is a plain string, so a package can target a region a newer
host added without waiting for a core release. A region only exists once something
renders it, though: adding an id without putting a slot in the host would
advertise a place to write that nobody reads.

### 2. Content items

Five data kinds, chosen because the host can draw all of them consistently:

`note` is a tone, a title, a markdown body and some actions. `action` is a link
rendered as a button. `fact` is a label and a value, optionally linked. `code` is
a command with a copy button. `checklist` is a list of steps, each `ok`,
`pending` or `blocked`.

Every item carries a namespaced `id` (`github/repository`) and an optional
`weight`. The id is the render key, decides which of two identical contributions
survives, and is what an organiser would name to suppress one. A generated id
would break all three on the next page load.

Keeping this vocabulary small is the load-bearing constraint. Fifteen kinds would
be a second design system with no maintainer, which is what the escape hatch
exists to prevent.

### 3. `surface.content`

One chained hook, keyed by region, threaded exactly like the gate chain:

```ts
content: async (request, next) => {
  const items = [...request.items, ...mine];
  return (await next?.({ ...request, items })) ?? items;
};
```

Returning your own list instead of what `next` handed back throws away every
contribution beneath you, and looks correct while doing it. So a package does not
write this. `surfaces()` in the SDK takes a map and writes it once:

```ts
surface: {
  content: surfaces({
    [surface.std.competitionYou]: async ({ user, subject }) => {
      if (!user || !(await hasEnrolment(user, subject.competition))) return [];
      const { owner, repo, url } = await repositoryFor(user);
      return [
        {
          kind: "action",
          id: "github/repository",
          label: "Open your repository",
          href: url,
          external: true,
          icon: "github",
        },
      ];
    },
  }),
}
```

A contributor that throws loses its own contribution and nothing else. Unlike a
gate, which fails closed because the alternative lets a submission through, a note
that cannot be built is only a note.

These run while a page renders, so an implementation has to be cheap. The host
caches per region, subject and reader for a minute; a package that needs a remote
call should memoise it, as `github-classic` memoises the GitHub login lookup.

### 4. `surface.view`, the escape hatch

Some content is not data the host can draw. A live branch list grows every time
somebody pushes and every row is its own link, which no `fact` or `note` can hold.

An item asks for a renderer by id, and a second chained hook resolves it:

```ts
// the item
{ kind: "component", id: "github/repository", view: "github/repository-card",
  chrome: "bare", props: { owner, repo, url, branches },
  fallback: { title: "Your repository", body: `\`${owner}/${repo}\` is ready.` } }

// the package
view: views({ "github/repository-card": lazyComponent(repositoryCard) })
```

`views()` answers for its own ids and passes anything else inward, so two
integrations can both draw into one region. Asking per id also keeps the wire
honest: only the bundle a page actually renders crosses it, and a view nobody asks
for is never built.

Views are reached through a `content` item rather than registered against a region
directly. That keeps ordering, identity and the whole decision about who sees what
in one place, and it lets a package choose per request: no repository yet gives you
a note, a live repository gives you the card.

A view is bundled, evaluated in the browser and mounted in a shadow root, so:

- The app's utility classes do not reach inside it. Custom properties do inherit
  across the boundary, so a view that reads `var(--foreground)` and
  `var(--border)` tracks the app's light and dark themes without a second palette
  to keep in step. `repository-card.tsx` is the worked example.
- Layout belongs to the host. `chrome: "panel"` puts the view in the app's panel
  under `title`, so a package that only wants the inside of a card does not draw
  one. Use `bare` in a region that is already inside a panel, such as
  `competition/you`, or the result is a card inside a card.
- Write the `fallback`. A build step and a shadow boundary are two more things
  that can fail on a machine the organiser owns and we do not, and the failure
  lands in the middle of somebody's competition page.

### 5. The host

A page names a region and what it is about:

```tsx
<SurfaceSlot
  surface={surface.std.competitionYou}
  subject={{ competition: competitionId }}
/>
```

`SurfaceSlot` renders nothing while it loads and nothing when there is nothing,
because most regions in most competitions have no contributions and a skeleton
would promise content to every reader and deliver it to almost none. That is also
why a caller can safely add a divider class to the slot: it draws only when
something is there.

`layout` decides how a run of actions sits. `stack` fills the width for a rail,
`inline` lets buttons size to their labels in a page body.

`src/lib/surface-fn.ts` runs the chain once for the whole product, which is where
three decisions live. It widens the subject, so a page that knows a submission id
does not have to look up the track and competition above it; contributors and
views get the widened version. It resolves the chain at the most specific config
node available, because `with:` propagates downward and a track's list already
contains its competition's. And it enforces the audience: `organiserOnly` regions
call `ensureAdmin` before the chain runs, since a server function is a public
endpoint whether or not a route renders it.

Ordering and identity are in `orderItems` in core rather than in the host, so a
second consumer applies the same rules. First contribution of an id wins, which is
the outermost package: the one listed last in `with:`, and so the one closest to
the organiser's own configuration. Sorting is by weight and then by arrival.

### 6. What changed in `useKitComponent`

The renderer lookup needed arguments, which the hook did not pass, so its shape
changed:

```tsx
// before
const Leaderboard = useKitComponent("leaderboard.ui", accessor);
// after
const { Component: Leaderboard } = useKitComponent("leaderboard.ui", {
  accessor,
});
```

Three things moved with it. Arguments are passed through to the hook and included
in the module cache key, since two views share a hook path and an accessor and
differ only by id. The query state comes back alongside the component, because the
component alone cannot say which of two silences it is in: the old code caught the
error, returned null, and the renderer read that as "still loading" and left a
spinner on the page for good. And the props and argument types are both derived
from the hook's own type, so a call site cannot ask `surface.view` for the wrong
thing.

## What `github-classic` contributes now

On `competition/you`, the repository card, for a competitor who has entered this
competition. Enrolment is what creates the repository, so linking to one before
then would hand somebody a 404 with our name on it.

On `track/detail`, a readiness checklist. The second step is the one worth having:
enrolment adds the competitor as a collaborator, GitHub turns that into an
invitation, and until they accept it the repository exists, the form lists no
branches, and nothing explains why. A pending invitation answers 404 on the
collaborator endpoint, which is what makes the difference visible at all.

On `enrolment/done`, the sentence this whole thing started with, plus the clone
command.

On `submission/new`, how submitting from a branch works, but only when the
track's form actually asks for a ref. One competition can mix tracks, and
explaining branches on a track that takes a zip would be a lie.

On `submission/detail`, the repository and ref the archive came from, linked to
the tree. A submission with no ref in its body is ordinary rather than
exceptional, so it reads as an absent contribution instead of a logged failure.

On `dashboard/overview`, the GitHub organisation, so an organiser does not read
the config to find it.

## Adding a region

One entry in `Subjects`, one constant in `std`, and one `<SurfaceSlot>` in the
host. No package changes, and `noop` is untouched.

Adding a hook group is the expensive one by comparison: the `Hooks` schema is a
`S.Struct`, so a merged package set missing a group fails to decode, which is why
`noop` implements the entire surface and is listed first in every config. When
`surface` was added, `noop` gained one line.

## Deliberately not here

Copy overrides. A package that wants a field relabelled has `form.loader`, which
is where `github-classic` already turns `github:ref-select` into a select. Letting
a package rewrite arbitrary product copy is a different feature with a much worse
failure mode.

Enforcement. If a package needs its setup to be a precondition rather than a
suggestion, `submissions.gate` refuses with a reason. A `checklist` item explains
the same thing without blocking, and the two are meant to be used together.

Navigation. An `app/nav` region is an easy addition, and was left out because
nothing needed it yet and a region nobody renders is worse than no region.
