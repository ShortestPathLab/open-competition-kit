# ui-service

`ui-service` is the web application for Open Competition Kit. It is built with TanStack Start, React, TanStack Router, Better Auth, and the kit SDK, and it provides the participant and organiser-facing screens for browsing competitions, viewing tracks and rules, enrolling, submitting work, inspecting jobs and outputs, viewing leaderboards, and managing account state.

Open Competition Kit is a modular toolkit for running programming competitions. A competition is described in `competition.config.yaml`, then extended with packages that provide storage, submission forms, enrolment behavior, runners, integrations, and leaderboards.

The UI service is not normally listed in the `with` section. It reads the configured kit and renders the behavior supplied by packages. Add UI-providing packages to `competition.config.yaml`, for example:

```yaml
with:
  - "@open-competition-kit/form-json"
  - "@open-competition-kit/leaderboard-ag-grid"
```

Run the service in development with:

```bash
bunx --bun vite dev --port 3000
```

For contributors, set up the repository from the monorepo root:

```bash
git clone https://github.com/open-competition-kit/open-competition-kit.git
cd open-competition-kit
bun install
```
