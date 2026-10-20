#!/usr/bin/env python3
"""Validate that Markdown image links resolve to local assets."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from urllib.parse import unquote


# Angle-bracket destinations may contain parentheses; plain destinations may not.
IMAGE_RE = re.compile(r"!\[[^\]]*]\((<[^>\n]+>|[^)\n]+)\)")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check local Markdown image links and enforce a minimum image count."
    )
    parser.add_argument("markdown", type=Path)
    parser.add_argument(
        "--min-images",
        type=int,
        default=0,
        help="Fail when fewer than this many local image links are present.",
    )
    return parser.parse_args()


def normalize_target(raw_target: str) -> str:
    target = raw_target.strip()
    if target.startswith("<") and target.endswith(">"):
        target = target[1:-1]
    # Strip an optional Markdown title after the path.
    target = re.split(r'\s+["\']', target, maxsplit=1)[0]
    return unquote(target)


def main() -> int:
    args = parse_args()
    markdown = args.markdown.expanduser().resolve()
    if not markdown.is_file():
        print(f"ERROR: Markdown file not found: {markdown}", file=sys.stderr)
        return 2

    text = markdown.read_text(encoding="utf-8")
    raw_targets = IMAGE_RE.findall(text)
    local_targets: list[Path] = []
    missing: list[Path] = []

    for raw_target in raw_targets:
        target = normalize_target(raw_target)
        if target.startswith(("http://", "https://", "data:")):
            continue
        path = Path(target)
        if not path.is_absolute():
            path = markdown.parent / path
        path = path.resolve()
        local_targets.append(path)
        if not path.is_file():
            missing.append(path)

    errors: list[str] = []
    if len(local_targets) < args.min_images:
        errors.append(
            f"found {len(local_targets)} local image link(s), "
            f"expected at least {args.min_images}"
        )
    if missing:
        errors.append(f"{len(missing)} local image link(s) are broken")

    print(
        f"{markdown.name}: {len(local_targets)} local image link(s), "
        f"{len(missing)} broken"
    )
    for path in missing:
        print(f"MISSING: {path}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
