#!/usr/bin/env python3
"""Assemble a timestamped source-language Markdown draft from transcript and screens."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True, type=Path)
    parser.add_argument("--transcript", required=True, type=Path)
    parser.add_argument("--screens", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--title")
    return parser.parse_args()


def clock(seconds: float) -> str:
    total = max(0, int(round(seconds)))
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}" if hours else f"{minutes:02d}:{secs:02d}"


def markdown_path(target: Path, base: Path) -> str:
    relative = Path(os.path.relpath(target, base)).as_posix()
    return f"<{relative}>" if any(char in relative for char in " ()") else relative


def main() -> int:
    args = parse_args()
    transcript = json.loads(args.transcript.read_text(encoding="utf-8"))
    manifest = json.loads(args.screens.read_text(encoding="utf-8"))
    screens = [item for item in manifest.get("screens", []) if item.get("keep", True)]
    if not screens:
        raise SystemExit("No retained screens in manifest")

    title = args.title or args.video.stem.replace("_", " ")
    lines = [
        f"# {title}",
        "",
        f"- Source video: `{args.video.name}`",
        f"- Duration: {clock(float(manifest['duration']))}",
        f"- Spoken language: {transcript.get('language') or 'unknown'}",
        "",
        "> Draft: verify transcription, screenshot coverage, paragraphing, and on-screen text before removing this notice.",
        "",
    ]

    segments = transcript.get("segments", [])
    for screen in screens:
        start = float(screen["segment_start"])
        end = float(screen["segment_end"])
        lines.extend([
            f"## {clock(start)}–{clock(end)}",
            "",
            f"![Complete page at {clock(float(screen['timestamp']))}]({markdown_path(Path(screen['file']), args.output.parent)})",
            "",
        ])
        assigned = []
        for segment in segments:
            midpoint = (float(segment["start"]) + float(segment["end"])) / 2
            if start <= midpoint < end or (end >= manifest["duration"] and midpoint <= end):
                text = str(segment.get("text", "")).strip()
                if text:
                    assigned.append(text)
        if assigned:
            lines.append(" ".join(assigned))
        else:
            lines.append("[No speech detected in this interval. Add essential on-screen text if needed.]")
        lines.append("")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print(f"Wrote draft Markdown with {len(screens)} sections to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
