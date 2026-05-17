# @open-competition-kit/integration-github-classic

`@open-competition-kit/integration-github-classic` connects Open Competition Kit to GitHub repositories. It creates or verifies a participant repository during enrolment, grants the participant push access, populates GitHub branch choices in submission forms, and prepares runner jobs by downloading the selected repository ref as a zip archive.

Open Competition Kit is a modular toolkit for running programming competitions. A competition is described in `competition.config.yaml`, then extended with packages that provide storage, submission forms, enrolment behavior, runners, integrations, and leaderboards.

To use the GitHub integration, add it to your `competition.config.yaml`:

```yaml
with:
  - "@open-competition-kit/integration-github-classic"
```

The package expects global secrets for `GITHUB_ORG` and `GITHUB_PAT`, and it uses the authenticated user's stored GitHub id to resolve their login. Submission forms can include a `github:ref-select` field; this package converts that field into a selectable list of branches from the participant repository.

For contributors, set up the repository from the monorepo root:

```bash
git clone https://github.com/open-competition-kit/open-competition-kit.git
cd open-competition-kit
bun install
```
