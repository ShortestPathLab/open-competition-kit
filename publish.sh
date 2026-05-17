#!/usr/bin/env sh

set -eu

directories="
packages/core
packages/packages/db/prisma
packages/packages/form/json
packages/packages/integration/github-classic
packages/packages/leaderboard/ag-grid
packages/packages/noop
packages/packages/standard
packages/sdk
"

for dir in $directories; do
  echo "Publishing $dir..."

  cd "$dir"
  bun pm version patch
  bun publish --access public

  cd - >/dev/null
done