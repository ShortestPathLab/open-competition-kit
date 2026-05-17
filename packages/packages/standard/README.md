# @open-competition-kit/standard

`@open-competition-kit/standard` implements the default competition workflow for Open Competition Kit. It creates enrolments, records submissions, opens pending jobs, resolves submitted source archives from job context, and runs the configured competition runner while writing job outputs and statuses back into the kit.

Open Competition Kit is a modular toolkit for running programming competitions. A competition is described in `competition.config.yaml`, then extended with packages that provide storage, submission forms, enrolment behavior, runners, integrations, and leaderboards.

To use the standard workflow package, add it to your `competition.config.yaml`:

```yaml
with:
  - "@open-competition-kit/standard"
```

This package expects another package or integration to place submission source code into job context under the standard source-code zip reference. The GitHub classic integration does that by downloading the selected repository ref before the runner executes.

For contributors, set up the repository from the monorepo root:

```bash
git clone https://github.com/open-competition-kit/open-competition-kit.git
cd open-competition-kit
bun install
```
