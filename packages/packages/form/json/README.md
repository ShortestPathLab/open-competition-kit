# @open-competition-kit/form-json

`@open-competition-kit/form-json` provides a JSON-driven submission form UI for Open Competition Kit. It turns a configured form shape into a React JSON Schema Form using the shadcn renderer and AJV validation, supporting common field kinds such as text, email, number, textarea, select, and checkbox.

Open Competition Kit is a modular toolkit for running programming competitions. A competition is described in `competition.config.yaml`, then extended with packages that provide storage, submission forms, enrolment behavior, runners, integrations, and leaderboards.

To use the JSON form package, add it to the relevant `with` section in your `competition.config.yaml`. You can enable it globally, or attach it to a competition, track, or form where the form UI should be supplied:

```yaml
with:
  - "@open-competition-kit/form-json"
```

The package reads the configured form `shape` and renders a submit-ready form component for the UI service.

For contributors, set up the repository from the monorepo root:

```bash
git clone https://github.com/open-competition-kit/open-competition-kit.git
cd open-competition-kit
bun install
```
