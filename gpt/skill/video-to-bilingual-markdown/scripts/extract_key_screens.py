#!/usr/bin/env python3
"""Detect major video page transitions and capture complete final page states."""

from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

try:
    import numpy as np
except ImportError:
    print(
        "numpy is required. Run with: uv run --with numpy python extract_key_screens.py ...",
        file=sys.stderr,
    )
    raise SystemExit(2)


def run(command: list[str], *, capture: bool = False) -> str:
    result = subprocess.run(
        command,
        check=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
        text=capture,
    )
    return result.stdout if capture else ""


def probe(video: Path) -> dict:
    raw = run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=width,height:format=duration", "-of", "json", str(video),
        ],
        capture=True,
    )
    data = json.loads(raw)
    stream = data["streams"][0]
    return {
        "duration": float(data["format"]["duration"]),
        "width": int(stream["width"]),
        "height": int(stream["height"]),
    }


def load_sampled_frames(video: Path, fps: float, width: int = 320, height: int = 180) -> np.ndarray:
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(video),
        "-vf", f"fps={fps},scale={width}:{height},format=gray",
        "-f", "rawvideo", "-pix_fmt", "gray", "-",
    ]
    raw = subprocess.check_output(command)
    frame_size = width * height
    if len(raw) % frame_size:
        raise RuntimeError("ffmpeg returned an incomplete raw frame")
    return np.frombuffer(raw, dtype=np.uint8).reshape((-1, height, width))


def cluster_transitions(times: list[float], min_gap: float) -> list[float]:
    clustered: list[float] = []
    for value in times:
        if not clustered or value - clustered[-1] >= min_gap:
            clustered.append(value)
    return clustered


def format_timestamp(seconds: float) -> str:
    total = max(0, int(round(seconds)))
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours:02d}h{minutes:02d}m{secs:02d}s"
    return f"{minutes:02d}m{secs:02d}s"


def extract_frame(video: Path, timestamp: float, output: Path) -> None:
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{timestamp:.3f}",
        "-i", str(video), "-frames:v", "1", "-compression_level", "3", str(output),
    ])


def make_contact_sheet(screens_dir: Path, output: Path, count: int) -> None:
    if count == 0:
        return
    columns = min(4, count)
    rows = math.ceil(count / columns)
    output.parent.mkdir(parents=True, exist_ok=True)
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", "1",
        "-pattern_type", "glob", "-i", str(screens_dir / "screen-*.png"),
        "-vf", f"scale=480:-2,tile={columns}x{rows}:padding=4:margin=4", "-frames:v", "1", str(output),
    ])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path)
    parser.add_argument("--screens-dir", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--contact-sheet", type=Path)
    parser.add_argument("--sample-fps", type=float, default=1.0)
    parser.add_argument("--pixel-threshold", type=int, default=16)
    parser.add_argument("--transition-fraction", type=float, default=0.08)
    parser.add_argument("--transition-mean", type=float, default=5.0)
    parser.add_argument("--guard-seconds", type=float, default=2.0)
    parser.add_argument("--min-page-seconds", type=float, default=8.0)
    parser.add_argument("--min-transition-gap", type=float, default=3.0)
    parser.add_argument("--clean", action="store_true", help="Remove existing screen-*.png files first")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.video.is_file():
        raise SystemExit(f"Video not found: {args.video}")
    for executable in ("ffmpeg", "ffprobe"):
        if not shutil.which(executable):
            raise SystemExit(f"Required executable not found: {executable}")

    metadata = probe(args.video)
    frames = load_sampled_frames(args.video, args.sample_fps)
    changes: list[dict] = []
    candidates: list[float] = []
    for index in range(1, len(frames)):
        delta = np.abs(frames[index].astype(np.int16) - frames[index - 1].astype(np.int16))
        mean = float(delta.mean())
        fraction = float((delta > args.pixel_threshold).mean())
        timestamp = index / args.sample_fps
        if fraction >= args.transition_fraction and mean >= args.transition_mean:
            candidates.append(timestamp)
            changes.append({"timestamp": timestamp, "mean_delta": mean, "changed_fraction": fraction})

    transitions = cluster_transitions(candidates, args.min_transition_gap)
    boundaries = [0.0, *transitions, metadata["duration"]]
    args.screens_dir.mkdir(parents=True, exist_ok=True)
    if args.clean:
        for existing in args.screens_dir.glob("screen-*.png"):
            existing.unlink()

    screens: list[dict] = []
    for start, end in zip(boundaries, boundaries[1:]):
        if end - start < args.min_page_seconds:
            continue
        timestamp = max(start + min(1.0, (end - start) / 4), end - args.guard_seconds)
        timestamp = min(timestamp, metadata["duration"] - 0.1)
        number = len(screens) + 1
        filename = f"screen-{number:03d}-{format_timestamp(timestamp)}.png"
        output = args.screens_dir / filename
        extract_frame(args.video, timestamp, output)
        screens.append({
            "id": number,
            "segment_start": round(start, 3),
            "segment_end": round(end, 3),
            "timestamp": round(timestamp, 3),
            "file": str(output.resolve()),
            "selection": "automatic-final-stable-frame",
            "keep": True,
        })

    # Keep transcript coverage continuous through a short decorative outro even
    # when that outro does not deserve its own screenshot.
    if screens:
        screens[-1]["segment_end"] = round(metadata["duration"], 3)

    manifest = {
        "source": str(args.video.resolve()),
        "duration": metadata["duration"],
        "resolution": {"width": metadata["width"], "height": metadata["height"]},
        "detector": {
            "sample_fps": args.sample_fps,
            "pixel_threshold": args.pixel_threshold,
            "transition_fraction": args.transition_fraction,
            "transition_mean": args.transition_mean,
            "guard_seconds": args.guard_seconds,
            "min_page_seconds": args.min_page_seconds,
        },
        "transition_candidates": changes,
        "transitions": transitions,
        "screens": screens,
    }
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.contact_sheet:
        make_contact_sheet(args.screens_dir, args.contact_sheet, len(screens))
    print(f"Detected {len(transitions)} major transitions; wrote {len(screens)} candidate screens")
    print(f"Manifest: {args.manifest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
