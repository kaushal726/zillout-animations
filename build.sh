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
