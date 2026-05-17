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

build_image "dockerfile.services.runner.runner-service" "${IMAGE_PREFIX}-services-runners-runner-service"
build_image "dockerfile.services.ui-service" "${IMAGE_PREFIX}-services-ui-service"
