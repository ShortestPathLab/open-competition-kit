# `@open-competition-kit/leaderboard-chart`

Draws a leaderboard as a bar, line, or area chart, using Recharts.

A whole board, not half of one. It implements `leaderboard.ui` to draw the chart
and `leaderboard.loader` to compute what goes in it, so installing this is all it
takes to get standings out of job outputs and onto a page.

## Using it

Install it once, at the top of the config, and each board that wants a chart says
so with `kind: chart`. Every installed renderer answers for the kinds it draws
and passes the rest inward, so one competition mixes a table, cards, and a chart
without any board installing a package of its own.

```yaml
with:
  - "@open-competition-kit/leaderboard-chart"

# ...

leaderboards:
  - id: score-distribution
    name: Score Distribution
    kind: chart
    from:
      track: main
      rank: { field: score, order: desc }
    options:
      plot: bar
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

| Key       | Default                  | Meaning                          |
| --------- | ------------------------ | -------------------------------- |
| `plot`    | `bar`                    | `bar`, `line`, or `area`.        |
| `x`       | first non-numeric column | The category axis.               |
| `series`  | the first numeric column | Which columns to plot.           |
| `stacked` | `false`                  | Stack series (`bar` and `area`). |
| `height`  | `360`                    | Chart height in pixels.          |

### Why `series` defaults to _one_ column

Leaderboard columns routinely differ by orders of magnitude, a score of `98`
next to an elapsed time of `1610`. Plotting both against a single axis makes the
smaller one a flat sliver and the chart useless. So only the first numeric column
is plotted unless you ask for more, and `rank` is never plotted at all (it is an
index, not a measurement).

If you do need two measures, prefer two charts over two series.

## Notes

Renderers are mounted in a shadow root with no global stylesheet, so this package
carries its own theme and styles everything inline. It picks light or dark from
the surrounding page via `useHostDarkMode` in `@open-competition-kit/sdk/theme`,
which reads the class the app puts on `<html>` and only consults
`prefers-color-scheme` when the app sets none. Reading the media query alone
would override a reader who picked light on a dark-scheme machine.

The chart draws its own card: a host places a renderer bare, under the board's
heading, so the surface has to come from here rather than from a panel around
it. Its background, border and radius name `--card`, `--border` and `--radius`,
which cross the shadow boundary, so the plot sits on the same surface as
everything else on the page; the theme's own values are the fallback for a
render with no page above it.

The categorical palette is the exception. It is fixed-order and validated for
colour-vision deficiency against both surfaces, and charts with two or more
series always show a legend, so identity never rests on colour alone. Those
values are chosen for chart legibility rather than to match the app, so the
series colours do not follow the host's tokens.
