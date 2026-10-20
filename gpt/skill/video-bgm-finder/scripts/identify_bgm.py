#!/usr/bin/env python3
"""Identify likely BGM from a video URL or local media file.

Requires ffmpeg/ffprobe. For URLs, requires yt-dlp. For recognition, requires
shazamio. The script extracts short clips instead of uploading full media.
"""

from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse


DEFAULT_MARKDOWN_LOG = "bgm-identifications.md"


def configure_ssl_certs() -> None:
    """Use certifi when available; some macOS Python installs lack CA config."""
    try:
        import certifi
    except Exception:
        return

    cert_path = certifi.where()
    os.environ.setdefault("SSL_CERT_FILE", cert_path)
    os.environ.setdefault("REQUESTS_CA_BUNDLE", cert_path)


def is_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def which_or_die(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise SystemExit(f"Missing required command: {name}")
    return path


def yt_dlp_command() -> list[str]:
    exe = shutil.which("yt-dlp")
    if exe:
        return [exe]
    try:
        import yt_dlp  # noqa: F401
    except Exception as exc:
        raise SystemExit(
            "Missing yt-dlp. Install it with: python3 -m pip install yt-dlp"
        ) from exc
    return [sys.executable, "-m", "yt_dlp"]


def run(cmd: list[str], *, capture: bool = False) -> subprocess.CompletedProcess[str]:
    kwargs: dict[str, Any] = {"text": True}
    if capture:
        kwargs.update({"stdout": subprocess.PIPE, "stderr": subprocess.PIPE})
    proc = subprocess.run(cmd, **kwargs)
    if proc.returncode != 0:
        detail = proc.stderr.strip() if capture and proc.stderr else " ".join(cmd)
        raise SystemExit(f"Command failed: {detail}")
    return proc


def download_audio(url: str, workdir: Path, cookies: str | None) -> Path:
    output_template = str(workdir / "source.%(ext)s")
    cmd = yt_dlp_command()
    if cookies:
        cmd += ["--cookies", cookies]
    cmd += [
        "--no-playlist",
        "--no-progress",
        "--restrict-filenames",
        "-f",
        "bestaudio/best",
        "-o",
        output_template,
        url,
    ]
    run(cmd)
    candidates = sorted(workdir.glob("source.*"))
    if not candidates:
        raise SystemExit("yt-dlp completed but no source media file was found.")
    return candidates[0]


def fetch_metadata(source: str, cookies: str | None) -> dict[str, Any]:
    if not is_url(source):
        path = Path(source).expanduser()
        return {
            "title": path.stem,
            "webpage_url": str(path),
            "uploader": None,
            "duration_string": None,
        }

    cmd = yt_dlp_command()
    if cookies:
        cmd += ["--cookies", cookies]
    cmd += ["--no-playlist", "--dump-single-json", source]
    proc = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        return {
            "title": source,
            "webpage_url": source,
            "uploader": None,
            "duration_string": None,
            "metadata_error": proc.stderr.strip(),
        }
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return {
            "title": source,
            "webpage_url": source,
            "uploader": None,
            "duration_string": None,
            "metadata_error": "yt-dlp returned non-JSON metadata.",
        }
    return {
        "title": data.get("title") or data.get("fulltitle") or source,
        "webpage_url": data.get("webpage_url") or data.get("original_url") or source,
        "uploader": data.get("uploader"),
        "duration_string": data.get("duration_string"),
        "description": data.get("description"),
    }


def probe_duration(media: Path) -> float:
    proc = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(media),
        ],
        capture=True,
    )
    try:
        return float(proc.stdout.strip())
    except ValueError as exc:
        raise SystemExit("Could not determine media duration with ffprobe.") from exc


def sample_starts(duration: float, samples: int, clip_length: float) -> list[float]:
    if duration <= 0:
        return [0.0]
    if duration <= clip_length + 2:
        return [0.0]

    usable_end = max(duration - clip_length, 0)
    if samples <= 1:
        return [min(max(duration * 0.35, 0), usable_end)]

    start_margin = min(12.0, usable_end * 0.15)
    end = max(start_margin, usable_end - start_margin)
    if math.isclose(start_margin, end):
        return [start_margin]

    starts = []
    for idx in range(samples):
        fraction = idx / max(samples - 1, 1)
        starts.append(start_margin + (end - start_margin) * fraction)
    return sorted({round(value, 2) for value in starts})


def extract_clip(media: Path, out: Path, start: float, length: float) -> None:
    run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            f"{start:.2f}",
            "-i",
            str(media),
            "-t",
            f"{length:.2f}",
            "-vn",
            "-ac",
            "1",
            "-ar",
            "44100",
            "-af",
            "loudnorm",
            str(out),
        ]
    )


def format_ts(seconds: float) -> str:
    total = int(round(seconds))
    mins, secs = divmod(total, 60)
    hours, mins = divmod(mins, 60)
    if hours:
        return f"{hours:02d}:{mins:02d}:{secs:02d}"
    return f"{mins:02d}:{secs:02d}"


async def recognize_with_shazam(path: Path) -> dict[str, Any]:
    try:
        from shazamio import Shazam
    except Exception as exc:
        raise SystemExit(
            "Missing shazamio. Install it with: python3 -m pip install shazamio"
        ) from exc

    shazam = Shazam()
    for method_name in ("recognize", "recognize_song"):
        method = getattr(shazam, method_name, None)
        if method:
            return await method(str(path))
    raise SystemExit("Installed shazamio does not expose a supported recognize method.")


def parse_track(raw: dict[str, Any]) -> dict[str, Any] | None:
    track = raw.get("track")
    if not isinstance(track, dict):
        return None

    title = track.get("title")
    artist = track.get("subtitle")
    if not title and not artist:
        return None

    share = track.get("share") if isinstance(track.get("share"), dict) else {}
    images = track.get("images") if isinstance(track.get("images"), dict) else {}
    matches = raw.get("matches") if isinstance(raw.get("matches"), list) else []
    return {
        "title": title,
        "artist": artist,
        "key": track.get("key"),
        "url": share.get("href") or track.get("url"),
        "cover": images.get("coverart"),
        "matches": len(matches),
    }


def aggregate(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, Any]] = {}
    for item in results:
        track = item.get("track")
        if not track:
            continue
        title = (track.get("title") or "").strip().lower()
        artist = (track.get("artist") or "").strip().lower()
        key = f"{title}|{artist}"
        if key not in groups:
            groups[key] = {
                "title": track.get("title"),
                "artist": track.get("artist"),
                "url": track.get("url"),
                "cover": track.get("cover"),
                "count": 0,
                "match_score": 0,
                "timestamps": [],
            }
        groups[key]["count"] += 1
        groups[key]["match_score"] += int(track.get("matches") or 0)
        groups[key]["timestamps"].append(item["timestamp"])
    return sorted(
        groups.values(),
        key=lambda value: (value["count"], value["match_score"]),
        reverse=True,
    )


def track_key(track: dict[str, Any]) -> str:
    title = (track.get("title") or "").strip().lower()
    artist = (track.get("artist") or "").strip().lower()
    return f"{title}|{artist}"


def build_segments(
    results: list[dict[str, Any]], clip_length: float, duration: float
) -> list[dict[str, Any]]:
    segments: list[dict[str, Any]] = []
    for item in sorted(results, key=lambda value: value["start_seconds"]):
        track = item.get("track")
        if not track:
            continue

        start = float(item["start_seconds"])
        end = min(duration, start + clip_length)
        key = track_key(track)
        previous = segments[-1] if segments else None
        can_merge = (
            previous
            and previous["key"] == key
            and start <= previous["end_seconds"] + clip_length * 1.25
        )

        if can_merge:
            previous["end_seconds"] = max(previous["end_seconds"], end)
            previous["timestamps"].append(item["timestamp"])
            previous["count"] += 1
            previous["match_score"] += int(track.get("matches") or 0)
            previous["confidence"] = segment_confidence(previous)
            continue

        segment = {
            "key": key,
            "start_seconds": start,
            "end_seconds": end,
            "start": format_ts(start),
            "end": format_ts(end),
            "title": track.get("title"),
            "artist": track.get("artist"),
            "url": track.get("url"),
            "count": 1,
            "match_score": int(track.get("matches") or 0),
            "timestamps": [item["timestamp"]],
        }
        segment["confidence"] = segment_confidence(segment)
        segments.append(segment)
    return segments


def segment_confidence(segment: dict[str, Any]) -> str:
    if segment["count"] >= 2:
        return "high"
    if segment["match_score"] >= 2:
        return "medium"
    return "low"


def confidence(best: dict[str, Any] | None, total_samples: int, alternatives: int) -> str:
    if not best:
        return "none"
    if best["count"] >= 2 and alternatives <= 2:
        return "high"
    if best["count"] >= 1 and total_samples <= 3:
        return "medium"
    if best["count"] >= 1:
        return "low"
    return "none"


def markdown_escape(value: Any) -> str:
    text = "" if value is None else str(value)
    return text.replace("[", "\\[").replace("]", "\\]")


def markdown_link(label: Any, url: Any) -> str:
    label_text = markdown_escape(label)
    if not url:
        return label_text
    return f"[{label_text}]({url})"


def netease_search_url(title: Any, artist: Any = None) -> str:
    query = " ".join(part for part in [str(title or "").strip(), str(artist or "").strip()] if part)
    return "https://music.163.com/#/search/m/?s=" + quote(query) + "&type=1"


def music_link(title: Any, artist: Any = None) -> str:
    label = " - ".join(part for part in [str(title or "").strip(), str(artist or "").strip()] if part)
    return markdown_link(label or "Unknown track", netease_search_url(title, artist))


def render_markdown_entry(report: dict[str, Any]) -> str:
    metadata = report.get("metadata") or {}
    title = metadata.get("title") or report.get("input")
    source_url = metadata.get("webpage_url") or report.get("input")
    uploader = metadata.get("uploader")
    generated_at = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    lines = [
        f"- [ ] `{generated_at}` {markdown_link(title, source_url)}",
        f"  - 时长：{format_ts(float(report.get('duration_seconds') or 0))}；总体置信度：`{report.get('confidence')}`",
    ]
    if uploader:
        lines.append(f"  - 发布者：{markdown_escape(uploader)}")

    lines.append("  - BGM：")
    segments = report.get("segments") or []
    if not segments:
        lines.append("    - [ ] 未识别到稳定 BGM；建议增加采样数量或提供更干净的音频。")
    for segment in segments:
        title_link = music_link(segment.get("title"), segment.get("artist"))
        evidence = ", ".join(segment.get("timestamps") or [])
        lines.append(
            "    - [ ] "
            f"`{segment['start']}-{segment['end']}` "
            f"**{title_link}**；"
            f"置信度：`{segment['confidence']}`；"
            f"证据：{segment['count']} 次命中（{evidence}）"
        )

    candidates = report.get("candidates") or []
    if candidates:
        lines.append("  - 候选汇总：")
        for candidate in candidates[:5]:
            title_link = music_link(candidate.get("title"), candidate.get("artist"))
            timestamps = ", ".join(candidate.get("timestamps") or [])
            lines.append(
                "    - "
                f"{title_link}；"
                f"命中 {candidate.get('count')} 次；"
                f"时间点：{timestamps}"
            )

    if report.get("notes"):
        lines.append(f"  - 备注：{markdown_escape(report['notes'])}")
    return "\n".join(lines)


def append_markdown_log(path: str, markdown_entry: str) -> Path:
    output = Path(path).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists() and output.stat().st_size > 0:
        with output.open("a", encoding="utf-8") as file:
            file.write("\n\n" + markdown_entry + "\n")
    else:
        output.write_text("# BGM Identification Log\n\n" + markdown_entry + "\n", encoding="utf-8")
    return output


async def main_async() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="Video/audio URL or local media path")
    parser.add_argument("--cookies", help="yt-dlp cookies.txt for restricted URLs")
    parser.add_argument("--samples", type=int, default=5, help="Number of clips to test")
    parser.add_argument("--clip-length", type=float, default=14.0, help="Seconds per clip")
    parser.add_argument("--workdir", help="Directory for downloaded media and clips")
    parser.add_argument("--keep", action="store_true", help="Keep temporary workdir")
    parser.add_argument("--json", dest="json_path", help="Write full JSON report to path")
    parser.add_argument("--title", help="Override the video title used in Markdown")
    parser.add_argument("--source-url", help="Override the source URL used in Markdown")
    parser.add_argument("--uploader", help="Override the uploader/publisher used in Markdown")
    parser.add_argument(
        "--append-md",
        default=DEFAULT_MARKDOWN_LOG,
        help=f"Append a Markdown checklist entry to this file (default: {DEFAULT_MARKDOWN_LOG})",
    )
    parser.add_argument("--no-append-md", action="store_true", help="Do not append Markdown")
    parser.add_argument("--print-json", action="store_true", help="Print JSON instead of Markdown")
    args = parser.parse_args()

    configure_ssl_certs()
    which_or_die("ffmpeg")
    which_or_die("ffprobe")

    cleanup_workdir = False
    if args.workdir:
        workdir = Path(args.workdir).expanduser().resolve()
        workdir.mkdir(parents=True, exist_ok=True)
    else:
        workdir = Path(tempfile.mkdtemp(prefix="video-bgm-"))
        cleanup_workdir = not (args.keep or args.json_path)

    try:
        metadata = fetch_metadata(args.input, args.cookies)
        if args.title:
            metadata["title"] = args.title
        if args.source_url:
            metadata["webpage_url"] = args.source_url
        if args.uploader:
            metadata["uploader"] = args.uploader
        if is_url(args.input):
            media = download_audio(args.input, workdir, args.cookies)
        else:
            media = Path(args.input).expanduser().resolve()
            if not media.exists():
                raise SystemExit(f"Input file does not exist: {media}")

        duration = probe_duration(media)
        starts = sample_starts(duration, max(args.samples, 1), max(args.clip_length, 4.0))

        results: list[dict[str, Any]] = []
        for idx, start in enumerate(starts, 1):
            clip = workdir / f"sample-{idx:02d}-{int(start):06d}.wav"
            extract_clip(media, clip, start, args.clip_length)
            raw = await recognize_with_shazam(clip)
            track = parse_track(raw)
            results.append(
                {
                    "timestamp": format_ts(start),
                    "start_seconds": start,
                    "clip": str(clip),
                    "track": track,
                    "raw": raw,
                }
            )

        candidates = aggregate(results)
        best = candidates[0] if candidates else None
        segments = build_segments(results, args.clip_length, duration)
        report = {
            "input": args.input,
            "metadata": metadata,
            "media": str(media),
            "duration_seconds": duration,
            "workdir": str(workdir),
            "confidence": confidence(best, len(starts), len(candidates)),
            "best": best,
            "segments": segments,
            "candidates": candidates,
            "samples": [
                {k: v for k, v in item.items() if k != "raw"} for item in results
            ],
        }
        if not segments:
            report["notes"] = "No stable fingerprint match was found in the sampled audio."

        if args.json_path:
            Path(args.json_path).expanduser().write_text(
                json.dumps(report, indent=2, ensure_ascii=False) + "\n"
            )

        markdown_entry = render_markdown_entry(report)
        markdown_path = None
        if not args.no_append_md:
            markdown_path = append_markdown_log(args.append_md, markdown_entry)

        if args.print_json:
            print(json.dumps(report, indent=2, ensure_ascii=False))
        else:
            print(markdown_entry)
            if markdown_path:
                print(f"\nAppended Markdown: {markdown_path}")
        if not best:
            return 3
        return 0
    finally:
        if cleanup_workdir:
            shutil.rmtree(workdir, ignore_errors=True)
        elif not args.workdir:
            print(f"Kept workdir: {workdir}", file=sys.stderr)


def main() -> int:
    try:
        return asyncio.run(main_async())
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
