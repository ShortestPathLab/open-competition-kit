# @open-competition-kit/core

`@open-competition-kit/core` contains the core runtime model for Open Competition Kit. It defines the configuration schema, database and hook contracts, namespaced context helpers, collection utilities, and the `OpenCompetitionKit` service that ties those pieces together through Effect.

Open Competition Kit is a modular toolkit for running programming competitions. A competition is described in `competition.config.yaml`, then extended with packages that provide storage, submission forms, enrolment behavior, runners, integrations, and leaderboards.

Most competition projects do not add `@open-competition-kit/core` directly to the `with` section. It is the foundation used by the SDK and packages, and it is normally installed as a dependency of those packages. If you are building a package or service, import the core types and services from this module when you need the lower-level API:

```ts
import { OpenCompetitionKit, OpenCompetitionKitConfig } from "@open-competition-kit/core";
```

For contributors, set up the repository from the monorepo root:

```bash
git clone https://github.com/open-competition-kit/open-competition-kit.git
cd open-competition-kit
bun install
```
