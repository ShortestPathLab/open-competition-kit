#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_PREFIX="${IMAGE_PREFIX:-open-competition-kit}"

build_image() {
  local dockerfile="$1"
  local image_name="$2"

  echo "Building ${image_name}:latest from ${dockerfile}"
  docker build \
    --file "${ROOT_DIR}/${dockerfile}" \
    --tag "${image_name}:latest" \
    "${ROOT_DIR}"
}

build_image "dockerfile.services.base" "${IMAGE_PREFIX}-services-base"
build_image "dockerfile.services.runners.basic-runner" "${IMAGE_PREFIX}-services-runners-basic-runner"
build_image "dockerfile.services.ui" "${IMAGE_PREFIX}-services-ui"
