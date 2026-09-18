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
    "js/film/stops.js",
    "js/film/loader.js",
    "js/film/canvas.js",
    "js/film/timeline.js",
    "js/fx/energy.js",
    "js/fx/visualizer.js",
    "js/ui/preloader.js",
    "js/ui/nav.js",
    "js/ui/cursor.js",
    "js/ui/magnetic.js",
    "js/ui/reveal.js",
    "js/ui/rail.js",
    "js/ui/parallax.js",
    "js/ui/beats.js",
    "js/ui/debug.js",
    "js/main.js",
]

OUT = ROOT / "js/zillout.build.js"

IMPORT_RE = re.compile(r"^\s*import\s[^;]*;\s*$", re.MULTILINE)
EXPORT_RE = re.compile(r"^export\s+", re.MULTILINE)


def collect_exported_names(source: str) -> set[str]:
    names = set()
    for match in re.finditer(r"^export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)", source, re.MULTILINE):
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

        for name in collect_exported_names(source):
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
    print(f"exported names checked for collisions: {len(seen)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
