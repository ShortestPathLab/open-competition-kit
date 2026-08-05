# @open-competition-kit/leaderboard-ag-grid

`@open-competition-kit/leaderboard-ag-grid` draws a leaderboard as a sortable,
filterable, resizable grid, using AG Grid. It formats text, numbers, booleans and
empty cells from the column types the board declares.

A whole board, not half of one. It implements `leaderboard.ui` to draw the grid
and `leaderboard.loader` to compute what fills it, so installing this is all it
takes to get standings out of job outputs and onto a page.

Open Competition Kit is a modular toolkit for running programming competitions. A
competition is described in `competition.config.yaml`, then extended with
packages that provide storage, submission forms, enrolment behaviour, runners,
integrations, and leaderboards.

## Using it

Install it once, at the top of the config:

```yaml
with:
  - "@open-competition-kit/leaderboard-ag-grid"
```

This is the renderer a board gets when it names no `kind:` at all, as well as the
one that answers `kind: table`. A board declares a `shape` for its columns, and
either a `from:` block saying which jobs' outputs become rows or a literal
`items` list.

## What it draws

The grid and nothing else. The board's name and description belong to whoever
places it, and the UI service prints them above every leaderboard on its
leaderboards page, so the grid carries no heading of its own. It carries its own
border and radius instead of expecting a panel around it.

Its height follows its rows, up to a page of ten, so a five row board is five
rows tall rather than a fixed frame with a hole in it.

The first two columns are pinned, which keeps whose row it is on screen while
the scores scroll. Below 640px of grid width they are not: two pinned columns on
a phone leave a letterbox to read every other column through, so a narrow grid
scrolls whole instead.

## Theming

The grid's colours name the host page's CSS custom properties rather than fixed
values: `accentColor` is `var(--primary, ...)`, `backgroundColor` is
`var(--card, ...)`, and so on. Custom properties cross a shadow boundary, so the
grid picks up whatever the surrounding app has set on `<html>` and follows both
its palette and its light and dark modes. The literals beside each one are
fallbacks for a render with no page above it.

`browserColorScheme` is the exception. It drives the native scrollbars and needs
the literal `light` or `dark`, so it goes in a second param set that AG Grid
scopes to `[data-ag-theme-mode="dark"]`. That attribute has to sit on an
ancestor inside the same tree, because a selector in a shadow tree cannot see
the class on `<html>`, so the component puts it on its own root using
`useHostDarkMode` from `@open-competition-kit/sdk/theme`.

AG Grid needs no help finding where to put its stylesheet. It checks whether its
root is inside a shadow tree and injects there instead of `document.head`.

For contributors, set up the repository from the monorepo root:

```bash
git clone https://github.com/open-competition-kit/open-competition-kit.git
cd open-competition-kit
bun install
```
