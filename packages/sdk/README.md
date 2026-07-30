# @open-competition-kit/sdk

`@open-competition-kit/sdk` is the application-facing API for Open Competition Kit. It initializes the core services, exposes promise-based helpers for competitions, tracks, users, enrolments, submissions, jobs, forms, leaderboards, context, outputs, and secrets, and re-exports the core types package authors need.

Open Competition Kit is a modular toolkit for running programming competitions. A competition is described in `competition.config.yaml`, then extended with packages that provide storage, submission forms, enrolment behavior, runners, integrations, and leaderboards.

Most projects use the SDK from TypeScript code rather than adding it to a `with` section. Package authors import `Package`, `makeComponent`, `kit`, or specific helpers from the SDK:

```ts
import { kit, submissions, type Package } from "@open-competition-kit/sdk";
```

A package that wants to say something inside the product contributes content to a named region with `surfaces()`, and registers a renderer with `views()` for the rare case where data is not enough. Both are on `@open-competition-kit/sdk/surface`, which is safe to import from a browser component, along with the region ids and the item types:

```ts
import { surface, surfaces } from "@open-competition-kit/sdk/surface";
```

Runtime behavior still comes from packages listed in `competition.config.yaml`:

```yaml
with:
  - "@open-competition-kit/standard"
```

For contributors, set up the repository from the monorepo root:

```bash
git clone https://github.com/open-competition-kit/open-competition-kit.git
cd open-competition-kit
bun install
```
