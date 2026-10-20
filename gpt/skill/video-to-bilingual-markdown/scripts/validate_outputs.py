#!/usr/bin/env python3
"""Validate parallel video Markdown outputs and their local screenshot assets."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

IMAGE_RE = re.compile(r"!\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))\)")
TIME_RE = re.compile(r"^##\s+(\d{2}:\d{2}(?::\d{2})?)\s*[–-]", re.MULTILINE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("original", type=Path)
    parser.add_argument("translated", type=Path)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--min-screens", type=int, default=1)
    return parser.parse_args()


def image_links(text: str) -> list[str]:
    return [match.group(1) or match.group(2) for match in IMAGE_RE.finditer(text)]


def timestamp_value(value: str) -> int:
    parts = [int(part) for part in value.split(":")]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    return parts[0] * 3600 + parts[1] * 60 + parts[2]


def check_document(path: Path, minimum: int) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    if not path.is_file():
        return [], [f"Missing Markdown file: {path}"]
    text = path.read_text(encoding="utf-8")
    links = image_links(text)
    if len(links) < minimum:
        errors.append(f"{path.name}: found {len(links)} images, expected at least {minimum}")
    for link in links:
        if re.match(r"^[a-z]+://", link):
            errors.append(f"{path.name}: image must be local, not remote: {link}")
        elif not (path.parent / link).resolve().is_file():
            errors.append(f"{path.name}: missing image asset: {link}")
    times = [timestamp_value(value) for value in TIME_RE.findall(text)]
    if times != sorted(times):
        errors.append(f"{path.name}: section timestamps are out of order")
    return links, errors


def main() -> int:
    args = parse_args()
    original_links, errors = check_document(args.original, args.min_screens)
    translated_links, translated_errors = check_document(args.translated, args.min_screens)
    errors.extend(translated_errors)
    if original_links != translated_links:
        errors.append("Original and translated Markdown do not have identical image links in the same order")

    if args.manifest:
        if not args.manifest.is_file():
            errors.append(f"Missing screen manifest: {args.manifest}")
        else:
            manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
            retained = [item for item in manifest.get("screens", []) if item.get("keep", True)]
            if len(retained) != len(original_links):
                errors.append(
                    f"Manifest has {len(retained)} retained screens but Markdown has {len(original_links)} image links"
                )

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print(f"OK: {len(original_links)} parallel screenshot links validated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
