# @open-competition-kit/db-prisma

`@open-competition-kit/db-prisma` implements the database features of Open Competition Kit with Prisma. It adapts the kit's generic database hook interface to Prisma collections, handling `get`, `list`, `create`, `update`, and `delete` operations against the generated Prisma client.

Open Competition Kit is a modular toolkit for running programming competitions. A competition is described in `competition.config.yaml`, then assembled from packages that provide storage, forms, runners, integrations, and leaderboards.

To use the Prisma database package, add it to the top-level `with` section in your `competition.config.yaml`:

```yaml
with:
  - "@open-competition-kit/db-prisma"
```

This package expects the kit database configuration to provide the Prisma connection details, such as a PostgreSQL `db.url`. In local workspace development, the same entry may point at `./packages/packages/db/prisma` instead of the package name.

For contributors, set up the repository from the monorepo root:

```bash
git clone https://github.com/open-competition-kit/open-competition-kit.git
cd open-competition-kit
bun install
```
