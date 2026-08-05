# `@open-competition-kit/leaderboard-card`

Draws a leaderboard as a row of stat cards — one card per row, with a headline
number. Good for podiums, "overall best" callouts, and any board where the point
is a single figure rather than a table.

A whole board, not half of one. It implements `leaderboard.ui` to draw the cards
and `leaderboard.loader` to compute what goes on them, so installing this is all
it takes to get standings out of job outputs and onto a page.

## Using it

Install it once, at the top of the config, and each board that wants cards says
so with `kind: card`. Every installed renderer answers for the kinds it draws and
passes the rest inward, so a competition can put a podium above a table without
either board installing a package of its own.

```yaml
with:
  - "@open-competition-kit/leaderboard-card"

# ...

leaderboards:
  - id: podium
    name: Podium
    kind: card
    from:
      track: main
      rank: { field: score, order: desc }
      limit: 3
    options:
      metric: score
    shape:
      - id: rank
        name: Rank
        kind: number
      - id: user
        name: Competitor
      - id: score
        name: Score
        kind: number
      - id: elapsed
        name: Time (ms)
        kind: number
```

## `options`

| Key       | Default                                | Meaning                                      |
| --------- | -------------------------------------- | -------------------------------------------- |
| `metric`  | first numeric column that isn't `rank` | The headline number on each card.            |
| `title`   | first non-numeric column               | The card's heading — usually the competitor. |
| `limit`   | all rows                               | How many cards to show.                      |
| `columns` | up to 3                                | Maximum cards per row.                       |

Every column that is not the `metric`, the `title`, or `rank` becomes a
supporting stat line underneath the headline. `rank` is shown as a badge.

Prefer setting `limit` on the leaderboard's `from:` rather than here, so the
work of ranking is done once at the source.

## Notes

Renderers are mounted in a shadow root with no global stylesheet, so this package
carries its own theme and styles everything inline. It picks light or dark from
the surrounding page via `useHostDarkMode` in `@open-competition-kit/sdk/theme`,
which reads the class the app puts on `<html>` and only consults
`prefers-color-scheme` when the app sets none. Numbers are set in tabular figures
so they line up across cards.

The cards' background, border and radius name `--card`, `--border` and
`--radius`. Custom properties cross the shadow boundary, so a podium rendered
inside an app is made of the same surfaces as the rest of it, and falls back to
the theme's own near-white when nothing above sets them.
