# `@open-competition-kit/leaderboard-card`

Draws a leaderboard as a row of stat cards — one card per row, with a headline
number. Good for podiums, "overall best" callouts, and any board where the point
is a single figure rather than a table.

Implements `leaderboard.ui`. It renders whatever rows the `leaderboard.loader`
hook produced — see `@open-competition-kit/standard` for how rows are built from
job outputs.

## Using it

A leaderboard's own `with:` is applied *after* the ones it inherits, so naming
this package on a single board overrides the default renderer for that board
only.

```yaml
leaderboards:
  - id: podium
    name: Podium
    with:
      - "@open-competition-kit/leaderboard-card"
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

| Key | Default | Meaning |
|---|---|---|
| `metric` | first numeric column that isn't `rank` | The headline number on each card. |
| `title` | first non-numeric column | The card's heading — usually the competitor. |
| `limit` | all rows | How many cards to show. |
| `columns` | up to 3 | Maximum cards per row. |

Every column that is not the `metric`, the `title`, or `rank` becomes a
supporting stat line underneath the headline. `rank` is shown as a badge.

Prefer setting `limit` on the leaderboard's `from:` rather than here, so the
work of ranking is done once at the source.

## Notes

Renderers are mounted in a shadow root with no global stylesheet, so this package
carries its own theme and styles everything inline, following the OS light/dark
setting. Numbers are set in tabular figures so they line up across cards.
