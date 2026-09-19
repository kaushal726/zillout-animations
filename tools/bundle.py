#!/usr/bin/env python3
"""Concatenate the ES modules under js/ into one classic script.

Modules are listed dependency-first and their `import`/`export` keywords are
stripped, then the whole thing is wrapped in an IIFE so nothing leaks onto
`window`. Every module uses plain named exports with no aliasing or namespace
imports, which is what makes this safe to do textually.
"""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent

# Dependency order: a module may only use names defined above it.
MODULES = [
    "js/core/utils.js",
    "js/core/ticker.js",
    "js/core/hidpi.js",
    "js/core/scroll.js",
    "js/core/stage.js",
    "js/core/quality.js",
    "js/film/stops.js",
    "js/film/camera.js",
    "js/film/loader.js",
    "js/film/canvas.js",
    "js/film/cues.js",
    "js/film/timeline.js",
    "js/fx/energy.js",
    "js/fx/visualizer.js",
    "js/fx/field.js",
    "js/ui/preloader.js",
    "js/ui/nav.js",
    "js/ui/cursor.js",
    "js/ui/magnetic.js",
    "js/ui/reveal.js",
    "js/ui/rail.js",
    "js/ui/parallax.js",
    "js/ui/beats.js",
    "js/ui/hotspots.js",
    "js/ui/markers.js",
    "js/ui/kinetic.js",
    "js/ui/ring.js",
    "js/ui/debug.js",
    "js/main.js",
]

OUT = ROOT / "js/zillout.build.js"

IMPORT_RE = re.compile(r"^\s*import\s[^;]*;\s*$", re.MULTILINE)
EXPORT_RE = re.compile(r"^export\s+", re.MULTILINE)


def collect_top_level_names(source: str) -> set[str]:
    """Every top-level declaration, exported or not. Once concatenated, all
    modules share one scope, so a private name in one file collides with a
    private name in another just as surely as two exports would."""
    names = set()
    pattern = r"^(?:export\s+)?(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)"
    for match in re.finditer(pattern, source, re.MULTILINE):
        names.add(match.group(1))
    return names


def main() -> int:
    chunks = []
    seen: dict[str, str] = {}
    duplicates = []

    for rel in MODULES:
        path = ROOT / rel
        if not path.exists():
            print(f"missing module: {rel}", file=sys.stderr)
            return 1
        source = path.read_text()

        for name in collect_top_level_names(source):
            if name in seen:
                duplicates.append(f"{name} (in {seen[name]} and {rel})")
            else:
                seen[name] = rel

        source = IMPORT_RE.sub("", source)
        source = EXPORT_RE.sub("", source)
        chunks.append(f"/* ── {rel} ─────────────────────────────── */\n{source.strip()}\n")

    if duplicates:
        print("name collisions between modules:\n  " + "\n  ".join(duplicates), file=sys.stderr)
        return 1

    banner = (
        "/* ZILLOUT — generated bundle. Do not edit.\n"
        "   Source lives in js/ as ES modules; regenerate with ./build.sh\n"
        "   This exists so index.html also works when opened from file://  */\n"
    )
    body = "\n".join(chunks)
    OUT.write_text(f"{banner}\n;(function () {{\n'use strict';\n\n{body}\n}})();\n")

    size = OUT.stat().st_size
    print(f"bundled {len(MODULES)} modules -> {OUT.relative_to(ROOT)} ({size/1024:.1f} KB)")
    print(f"top-level names checked for collisions: {len(seen)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
