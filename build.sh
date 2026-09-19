#!/usr/bin/env bash
# Bundles the ES modules in js/ into a single classic script.
#
# Why: browsers refuse to load ES modules over file:// (CORS), so opening
# index.html by double-clicking would hang forever. The bundle is a plain
# script, which works from both file:// and a web server.
#
# The modules under js/ stay the source of truth — edit those, then run this.

set -euo pipefail
cd "$(dirname "$0")"
python3 tools/bundle.py

# The bundle is what ships, so it is what gets syntax-checked. Checking the
# individual modules is not enough: Node's check of an ES module file can
# pass early errors (a duplicate declaration, for one) that the bundle —
# a classic script — correctly rejects.
if command -v node >/dev/null 2>&1; then
  node --check js/zillout.build.js
  echo "bundle parses"
fi
