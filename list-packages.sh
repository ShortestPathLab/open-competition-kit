#!/usr/bin/env sh

# Prints the publishable package directories, dependencies before dependents.
#
# Discovered rather than listed. A hardcoded list goes stale silently: both
# large-files backends and both new leaderboard renderers were missing from
# publish.sh and from both CI matrices, so four packages simply never shipped
# and nothing said so.
#
# Publishable means scoped `@open-competition-kit/*`. The services are
# workspaces too, but they ship as containers and must never reach npm.

set -eu

repoRoot="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"

manifests="$(find "$repoRoot/packages" -name package.json -not -path '*/node_modules/*' | sort)"

# name -> directory, relative to the repo root.
map="$(
  for manifest in $manifests; do
    name="$(jq -r '.name // ""' "$manifest")"
    case "$name" in
      @open-competition-kit/*) ;;
      *) continue ;;
    esac
    dir="$(dirname "$manifest")"
    echo "$name ${dir#"$repoRoot"/}"
  done
)"

# "dependency dependent" pairs for tsort, plus a self-pair per package so that
# packages nothing depends on are still emitted.
pairs="$(
  for manifest in $manifests; do
    name="$(jq -r '.name // ""' "$manifest")"
    case "$name" in
      @open-competition-kit/*) ;;
      *) continue ;;
    esac
    echo "$name $name"
    jq -r --arg name "$name" '
      [(.dependencies // {}), (.peerDependencies // {})]
      | add // {}
      | keys[]
      | select(startswith("@open-competition-kit/"))
      | "\(.) \($name)"
    ' "$manifest"
  done
)"

# tsort reports a cycle on stderr and exits non-zero, which `set -e` turns into
# a failed publish — the right outcome, since no order would be correct.
for name in $(echo "$pairs" | tsort); do
  echo "$map" | awk -v name="$name" '$1 == name { print $2 }'
done
