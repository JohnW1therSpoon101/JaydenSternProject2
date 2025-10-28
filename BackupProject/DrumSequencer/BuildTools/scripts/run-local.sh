#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../frontend"

PORT=5500
echo "Serving frontend/ on http://localhost:$PORT"
python3 -m http.server "$PORT"