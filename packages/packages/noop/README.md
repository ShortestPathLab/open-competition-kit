# @open-competition-kit/noop

`@open-competition-kit/noop` provides a complete no-op implementation of the Open Competition Kit package surface. It is useful as a placeholder, baseline, or development aid when you want every hook to exist but do not want it to perform any behavior.

Open Competition Kit is a modular toolkit for running programming competitions. A competition is described in `competition.config.yaml`, then extended with packages that provide storage, submission forms, enrolment behavior, runners, integrations, and leaderboards.

To use the no-op package, add it to your `competition.config.yaml`:

```yaml
with:
  - "@open-competition-kit/noop"
```

Because this package intentionally returns no meaningful data, it is usually paired with real packages during development or used to make missing hooks explicit while another package is being built.

For contributors, set up the repository from the monorepo root:

```bash
git clone https://github.com/open-competition-kit/open-competition-kit.git
cd open-competition-kit
bun install
```
