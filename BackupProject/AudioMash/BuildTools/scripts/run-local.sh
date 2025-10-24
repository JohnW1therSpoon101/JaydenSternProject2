#!/usr/bin/env bash
# BuildTools/scripts/run-local.sh
set -euo pipefail

# Run from AudioMash/ directory:
#   bash BuildTools/scripts/run-local.sh
PORT=${1:-5500}
echo "Serving frontend/ on http://localhost:${PORT}"
python3 -m http.server "${PORT}" --directory frontend