#!/usr/bin/env bash

set -eu

find ./packages \
  -path '*/node_modules/*' -prune -o \
  -path '*/.nitro/*' -prune -o \
  -name tsconfig.json -type f -print | while read -r tsconfig; do

  dir="$(dirname "$tsconfig")"

  echo "Running tsc in $dir"

  (
    cd "$dir"
    bunx tsc
  ) || echo "Failed: $tsconfig"

done