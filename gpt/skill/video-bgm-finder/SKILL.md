---
name: video-bgm-finder
description: Use this skill when the user provides a video URL or local video/audio file and wants to identify the background music, BGM, soundtrack, song title, artist, or audio track used in the video. Handles public web videos with yt-dlp plus short audio fingerprint samples, outputs a Markdown checklist log with video URL, title, BGM time ranges, confidence, evidence, and access limitations.
---

# Video BGM Finder

## Overview

Identify likely background music from a video URL or local media file by extracting short audio samples and matching them with an audio recognition service. The default output is a Markdown checklist entry appended to `bgm-identifications.md` in the current working directory.

## Quick Start

Use the bundled helper first:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/video-bgm-finder/scripts/identify_bgm.py" "VIDEO_URL_OR_FILE"
```

For a named log file:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/video-bgm-finder/scripts/identify_bgm.py" "VIDEO_URL_OR_FILE" --append-md /path/to/bgm-list.md
```

If dependencies are missing, install or activate them before retrying:

```bash
python3 -m pip install yt-dlp shazamio
brew install ffmpeg
```

For authenticated or age-gated URLs, pass a cookies file exported for the site:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/video-bgm-finder/scripts/identify_bgm.py" "VIDEO_URL" --cookies /path/to/cookies.txt
```

## Workflow

1. Accept a video URL, audio URL, or local media path. If the user gives only a platform page, use that URL directly.
2. Run `scripts/identify_bgm.py`. It downloads or reads the media, fetches video metadata when possible, extracts short samples, and queries Shazam via `shazamio`.
3. Review the Markdown output and appended log. If multiple samples match the same track in nearby windows, treat the merged time range as stronger evidence.
4. If samples disagree, keep all candidate rows in the checklist and describe which time range each candidate came from.
5. If recognition fails, keep the checklist entry and explain the likely reason. Useful next steps are: try more/longer samples, use cookies for restricted content, ask for a higher-quality source, or inspect comments/description for music credits.
6. Return the Markdown path plus the most important result in plain language.

## Output Guidance

The script prints and appends this Markdown shape:

```markdown
- [ ] `YYYY-MM-DD HH:MM:SS` [Video Title](VIDEO_URL)
  - 时长：MM:SS；总体置信度：`medium`
  - 发布者：Uploader
  - BGM：
    - [ ] `02:24-02:52` **[Cyberpunk - Max Brhon](https://music.163.com/#/search/m/?s=Cyberpunk%20Max%20Brhon&type=1)**；置信度：`high`；证据：2 次命中（02:24, 02:36）
  - 候选汇总：
    - [Cyberpunk - Max Brhon](https://music.163.com/#/search/m/?s=Cyberpunk%20Max%20Brhon&type=1)；命中 2 次；时间点：02:24, 02:36
```

Keep the first checklist line compact because it is the main Markdown preview surface: timestamp plus a clickable video title. Do not repeat the video title or URL in child rows unless metadata is missing or the user asks for a verbose export. Music links should point to NetEase Cloud Music search pages using `track title + artist`; this is a search jump, not proof that the exact track exists on NetEase.

Confidence heuristic:

- `high`: two or more nearby samples identify the same title and artist.
- `medium`: one clean sample has multiple fingerprint matches, or the overall result has limited but plausible evidence.
- `low`: matches conflict, only one noisy match exists, or the result appears to be a remix/live/version mismatch.

For final chat responses, keep it concise:

```text
已追加到：/path/to/bgm-list.md
主要识别结果：Title - Artist
时间段：02:24-02:52
置信度：medium
备注：why confidence is not higher
```

## Failure Handling

- Do not claim a definitive BGM when no fingerprint match is found.
- Do not collapse conflicting candidates into one answer. Keep separate checklist rows for separate time ranges.
- For private, login-only, or region-blocked URLs, ask for cookies, a direct downloadable file, or a local file path.
- If the video has voiceover over quiet music, retry with denser samples: `--samples 20 --clip-length 12`.
- If the video is very short, let the script sample the whole usable duration.
- If the user needs copyright/licensing status, say that identification is not a license check.

## Script

The script lives at `scripts/identify_bgm.py`. It is intentionally self-contained and may be executed without loading more skill context.

Useful flags:

- `--append-md PATH`: append the Markdown checklist entry to a specific file. Defaults to `bgm-identifications.md`.
- `--no-append-md`: print Markdown without writing the log file.
- `--json PATH`: write the full machine-readable report.
- `--print-json`: print JSON instead of Markdown.
- `--title`, `--source-url`, `--uploader`: override Markdown metadata when processing a local file copied from an online video.
