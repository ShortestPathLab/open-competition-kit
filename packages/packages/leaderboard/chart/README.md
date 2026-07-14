# `@open-competition-kit/leaderboard-chart`

Draws a leaderboard as a bar, line, or area chart, using Recharts.

Implements `leaderboard.ui`. It renders whatever rows the `leaderboard.loader`
hook produced — see `@open-competition-kit/standard` for how rows are built from
job outputs.

## Using it

A leaderboard's own `with:` is applied *after* the ones it inherits, so naming
this package on a single board overrides the default renderer for that board
only. One competition can mix a table, cards, and a chart.

```yaml
leaderboards:
  - id: score-distribution
    name: Score Distribution
    with:
      - "@open-competition-kit/leaderboard-chart"
    from:
      track: main
      rank: { field: score, order: desc }
    options:
      kind: bar
      x: user
      series: [score]
    shape:
      - id: user
        name: Competitor
      - id: score
        name: Score
        kind: number
```

## `options`

| Key | Default | Meaning |
|---|---|---|
| `kind` | `bar` | `bar`, `line`, or `area`. |
| `x` | first non-numeric column | The category axis. |
| `series` | the first numeric column | Which columns to plot. |
| `stacked` | `false` | Stack series (`bar` and `area`). |
| `height` | `360` | Chart height in pixels. |

### Why `series` defaults to *one* column

Leaderboard columns routinely differ by orders of magnitude — a score of `98`
next to an elapsed time of `1610`. Plotting both against a single axis makes the
smaller one a flat sliver and the chart useless. So only the first numeric column
is plotted unless you ask for more, and `rank` is never plotted at all (it is an
index, not a measurement).

If you do need two measures, prefer two charts over two series.

## Notes

Renderers are mounted in a shadow root with no global stylesheet, so this package
carries its own theme and styles everything inline. It follows the OS light/dark
setting via `prefers-color-scheme`. The categorical palette is fixed-order and
validated for colour-vision deficiency against both surfaces; charts with two or
more series always show a legend, so identity never rests on colour alone.
