#!/usr/bin/env bash
set -euo pipefail

exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/apply-root-changes.sh" "$@"
