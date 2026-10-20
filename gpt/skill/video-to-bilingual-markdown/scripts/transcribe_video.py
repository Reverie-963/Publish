#!/usr/bin/env python3
"""Transcribe a local video with MLX or OpenAI Whisper and preserve timestamps."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--engine", choices=("auto", "mlx", "openai"), default="auto")
    parser.add_argument("--model", help="Model repository/name; defaults depend on the selected engine")
    parser.add_argument("--language", help="ISO language code; omit for auto-detection")
    parser.add_argument("--initial-prompt", help="Vocabulary/context hint for Whisper")
    parser.add_argument("--word-timestamps", action="store_true")
    return parser.parse_args()


def compact_segment(segment: dict) -> dict:
    keep = (
        "id",
        "start",
        "end",
        "text",
        "temperature",
        "avg_logprob",
        "compression_ratio",
        "no_speech_prob",
    )
    item = {key: segment[key] for key in keep if key in segment}
    if "words" in segment:
        item["words"] = [
            {key: word[key] for key in ("word", "start", "end", "probability") if key in word}
            for word in segment["words"]
        ]
    return item


def transcribe_mlx(args: argparse.Namespace) -> tuple[dict, str]:
    try:
        import mlx_whisper
    except ImportError:
        raise RuntimeError("mlx-whisper is not installed") from None

    model = args.model or "mlx-community/whisper-turbo"
    options = {
        "path_or_hf_repo": model,
        "task": "transcribe",
        "verbose": False,
        "word_timestamps": args.word_timestamps,
    }
    if args.language:
        options["language"] = args.language
    if args.initial_prompt:
        options["initial_prompt"] = args.initial_prompt

    return mlx_whisper.transcribe(str(args.video), **options), model


def transcribe_openai(args: argparse.Namespace) -> tuple[dict, str]:
    try:
        import whisper
    except ImportError:
        raise RuntimeError("openai-whisper is not installed") from None

    model_name = args.model or ("base.en" if args.language == "en" else "base")
    model = whisper.load_model(model_name)
    options = {
        "task": "transcribe",
        "verbose": False,
        "word_timestamps": args.word_timestamps,
    }
    if args.language:
        options["language"] = args.language
    if args.initial_prompt:
        options["initial_prompt"] = args.initial_prompt
    return model.transcribe(str(args.video), **options), model_name


def main() -> int:
    args = parse_args()
    if not args.video.is_file():
        raise SystemExit(f"Video not found: {args.video}")

    engines = ("mlx", "openai") if args.engine == "auto" else (args.engine,)
    failures: list[str] = []
    result = None
    model = None
    engine = None
    for candidate in engines:
        try:
            if candidate == "mlx":
                result, model = transcribe_mlx(args)
            else:
                result, model = transcribe_openai(args)
            engine = candidate
            break
        except RuntimeError as exc:
            failures.append(str(exc))
    if result is None or model is None or engine is None:
        print("No supported Whisper engine is available: " + "; ".join(failures), file=sys.stderr)
        print(
            "Use either `uv run --with mlx-whisper ...` or "
            "`uv run --with openai-whisper ...`.",
            file=sys.stderr,
        )
        return 2

    payload = {
        "source": str(args.video.resolve()),
        "engine": "mlx-whisper" if engine == "mlx" else "openai-whisper",
        "model": model,
        "task": "transcribe",
        "language": result.get("language", args.language),
        "text": result.get("text", "").strip(),
        "segments": [compact_segment(segment) for segment in result.get("segments", [])],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(payload['segments'])} segments to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
