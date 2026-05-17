# runner-service

`runner-service` is the basic polling runner for Open Competition Kit. It asks the SDK for jobs with the `pending` status, runs each job through the configured runner hooks, and repeats that polling loop every two seconds until the process receives `SIGINT` or `SIGTERM`.

Open Competition Kit is a modular toolkit for running programming competitions. A competition is described in `competition.config.yaml`, then extended with packages that provide storage, submission forms, enrolment behavior, runners, integrations, and leaderboards.

The runner service is not normally added to `competition.config.yaml`; it is a process you run beside the UI and database. The packages that define runner behavior should be listed in the config instead:

```yaml
with:
  - "@open-competition-kit/standard"
```

Run the service with Bun from this package or from the monorepo workspace:

```bash
bun run index.ts
```

For contributors, set up the repository from the monorepo root:

```bash
git clone https://github.com/open-competition-kit/open-competition-kit.git
cd open-competition-kit
bun install
```
