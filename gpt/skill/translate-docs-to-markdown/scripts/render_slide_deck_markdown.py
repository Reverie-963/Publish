#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

import fitz


IMAGE_LINE_RE = re.compile(r"^\s*!\[[^\]]*\]\(.+\)\s*$")
HEADING_RE = re.compile(r"^##\s+(.*?)(?:\s+\{#slide-(\d+)\})?\s*$")


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def export_powerpoint_to_pdf(source: Path, pdf_path: Path) -> None:
    script = f"""
set src to POSIX file "{source}"
set dst to POSIX file "{pdf_path}"
tell application "Microsoft PowerPoint"
    with timeout of 600 seconds
        open src
        set pres to active presentation
        save pres in dst as save as PDF
        close pres saving no
    end timeout
end tell
"""
    run(["osascript", "-e", script])
    for _ in range(60):
        if pdf_path.exists() and pdf_path.stat().st_size > 0:
            return
        time.sleep(0.5)
    raise FileNotFoundError(f"PowerPoint did not create expected PDF: {pdf_path}")


def render_pdf_slides(pdf_path: Path, slides_dir: Path, scale: float) -> int:
    slides_dir.mkdir(parents=True, exist_ok=True)
    for old in slides_dir.glob("slide-*.png"):
        old.unlink()

    doc = fitz.open(pdf_path)
    matrix = fitz.Matrix(scale, scale)
    width = 2
    for index, page in enumerate(doc, 1):
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        pix.save(slides_dir / f"slide-{index:0{width}d}.png")
    return len(doc)


def clean_heading_title(raw: str) -> str:
    title = re.sub(r"\s+\{#slide-\d+\}\s*$", "", raw).strip()
    return title


def is_generic_slide_heading(title: str) -> bool:
    return bool(re.fullmatch(r"幻灯片\s+\d+|Slide\s+\d+", title.strip(), flags=re.I))


def split_markdown_by_slide(markdown: str) -> list[tuple[int, str, list[str]]]:
    slides: list[tuple[int, str, list[str]]] = []
    current_number: int | None = None
    current_title = ""
    current_lines: list[str] = []

    def flush() -> None:
        if current_number is not None:
            slides.append((current_number, current_title, current_lines.copy()))

    inferred = 0
    for line in markdown.splitlines():
        match = HEADING_RE.match(line)
        if match:
            flush()
            inferred += 1
            current_number = int(match.group(2) or inferred)
            current_title = clean_heading_title(match.group(1))
            current_lines = []
            continue
        if current_number is not None:
            current_lines.append(line)

    flush()
    return slides


def should_drop_line(line: str, unit_labels: set[str]) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if IMAGE_LINE_RE.match(line):
        return True
    if stripped == "[图形：原 PPT 中的嵌入对象]":
        return True
    if stripped.startswith("页码："):
        return True
    if stripped in unit_labels:
        return True
    if stripped == "<!-- -->":
        return True
    return False


def clean_slide_body(title: str, lines: list[str], unit_labels: set[str]) -> list[str]:
    cleaned: list[str] = []
    if title and not is_generic_slide_heading(title):
        cleaned.append(title)
        cleaned.append("")

    for line in lines:
        if should_drop_line(line, unit_labels):
            continue
        cleaned.append(line.rstrip())

    while cleaned and not cleaned[0].strip():
        cleaned.pop(0)
    while cleaned and not cleaned[-1].strip():
        cleaned.pop()

    compact: list[str] = []
    previous_blank = False
    for line in cleaned:
        blank = not line.strip()
        if blank and previous_blank:
            continue
        compact.append(line)
        previous_blank = blank
    return compact


def assemble_markdown(
    *,
    source: Path,
    translated_md: Path,
    output_md: Path,
    assets_dir: Path,
    deck_title: str,
    source_label: str,
    note: str,
    slide_count: int,
) -> None:
    text = translated_md.read_text(encoding="utf-8")
    slides = split_markdown_by_slide(text)
    unit_labels = {
        "单元 1：概述",
        "单元 2：应用层",
        "Unit 1: Overview",
        "Unit 2: Application Layer",
    }

    width = 2
    lines = [
        f"# {deck_title}（中文翻译）",
        "",
        f"{source_label}：`{source.name}`",
        "",
        f"说明：{note}",
        "",
    ]

    slide_map = {number: (title, body) for number, title, body in slides}
    for number in range(1, slide_count + 1):
        title, body = slide_map.get(number, ("", []))
        rel_image = Path(os.path.relpath(assets_dir / "slides" / f"slide-{number:0{width}d}.png", output_md.parent)).as_posix()
        lines.extend(
            [
                f"## 幻灯片 {number}",
                "",
                f"![Slide {number}](<{rel_image}>)",
                "",
            ]
        )
        cleaned = clean_slide_body(title, body, unit_labels)
        if cleaned:
            lines.extend(cleaned)
        else:
            lines.append("本页主要内容见原始幻灯片图像。")
        lines.append("")

    output_md.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Render a slide deck to PNGs and assemble translated Markdown in slide-image style."
    )
    parser.add_argument("source", type=Path, help="Source .pdf, .ppt, or .pptx deck")
    parser.add_argument("--translated-md", type=Path, required=True)
    parser.add_argument("--output-md", type=Path, required=True)
    parser.add_argument("--assets-dir", type=Path, required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--source-label", default="源文件")
    parser.add_argument(
        "--note",
        default=(
            "每张幻灯片保留原始渲染图，下面给出中文翻译。"
            "关键术语尽量以 `中文（English）` 形式保留原英文；代码、协议名、URL 和公式保持原样。"
        ),
    )
    parser.add_argument("--scale", type=float, default=2.0)
    parser.add_argument("--keep-pdf", type=Path)
    args = parser.parse_args()

    source = args.source.resolve()
    assets_dir = args.assets_dir.resolve()
    slides_dir = assets_dir / "slides"
    assets_dir.mkdir(parents=True, exist_ok=True)

    suffix = source.suffix.lower()
    with tempfile.TemporaryDirectory(prefix="slide-deck-md-") as tmp:
        tmp_pdf = Path(tmp) / f"{source.stem}.pdf"
        if suffix == ".pdf":
            pdf_path = source
        elif suffix in {".ppt", ".pptx"}:
            export_powerpoint_to_pdf(source, tmp_pdf)
            pdf_path = tmp_pdf
        else:
            raise SystemExit(f"Unsupported source type: {source.suffix}")

        slide_count = render_pdf_slides(pdf_path, slides_dir, args.scale)
        if args.keep_pdf:
            args.keep_pdf.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(pdf_path, args.keep_pdf)

    assemble_markdown(
        source=source,
        translated_md=args.translated_md.resolve(),
        output_md=args.output_md.resolve(),
        assets_dir=assets_dir,
        deck_title=args.title,
        source_label=args.source_label,
        note=args.note,
        slide_count=slide_count,
    )
    print(f"wrote {args.output_md}")
    print(f"rendered {slide_count} slides to {slides_dir}")


if __name__ == "__main__":
    main()
