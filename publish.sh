#!/usr/bin/env sh

set -eu

versionType="${1:-patch}"

repoRoot="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
packages="$("$repoRoot/list-packages.sh")"

# Bump every version before publishing any of them.
#
# `bun publish` replaces `workspace:*` with an exact pin — "@open-competition-kit/sdk":
# "0.0.7", not "^0.0.7" — and takes that version from the *lockfile*. Bumping and
# publishing one package at a time therefore shipped every dependent pinned to the
# previous sdk, since sdk was bumped last: installing standard@0.0.7 dragged in
# sdk@0.0.6 and missed the very APIs the release was cut for.
for dir in $packages; do
  echo "Versioning $dir..."
  (cd "$repoRoot/$dir" && bun pm version "$versionType" --no-git-tag-version)
done

# Teach the lockfile the new versions, or the pins above stay stale and the two
# passes buy nothing. Only `bun update` does this: `bun install`, `--force` and
# `--lockfile-only` all leave the recorded workspace versions untouched, and
# deleting the lockfile re-resolves the whole tree.
#
# `bun update` also advances third-party dependencies to the newest version
# their range allows and writes the new range back, so a release can carry an
# unrelated upgrade with it. Read `git diff` before committing. CI does the same
# thing, but throws the checkout away afterwards.
echo "Refreshing the lockfile..."
(cd "$repoRoot" && bun update)

# Dependencies first, so the registry never holds a package whose pinned
# dependency has not been published yet.
for dir in $packages; do
  echo "Publishing $dir..."
  (cd "$repoRoot/$dir" && bun publish --access public)
done
