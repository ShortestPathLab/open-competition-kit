# @open-competition-kit/leaderboard-ag-grid

`@open-competition-kit/leaderboard-ag-grid` provides a leaderboard UI for Open Competition Kit using AG Grid. It converts a configured leaderboard shape and item list into a sortable, filterable, resizable React grid with sensible formatting for text, numbers, booleans, and empty values.

Open Competition Kit is a modular toolkit for running programming competitions. A competition is described in `competition.config.yaml`, then extended with packages that provide storage, submission forms, enrolment behavior, runners, integrations, and leaderboards.

To use the AG Grid leaderboard package, add it to the relevant `with` section in your `competition.config.yaml`:

```yaml
with:
  - "@open-competition-kit/leaderboard-ag-grid"
```

A leaderboard definition should provide a `shape` for the columns and `items` for the rows. The UI service loads this package as the renderer when displaying configured leaderboards.

For contributors, set up the repository from the monorepo root:

```bash
git clone https://github.com/open-competition-kit/open-competition-kit.git
cd open-competition-kit
bun install
```
