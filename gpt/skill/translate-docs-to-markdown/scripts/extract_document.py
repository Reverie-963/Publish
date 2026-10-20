#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import fitz
from docx import Document
from docx.document import Document as DocxDocument
from docx.table import Table, _Cell
from docx.text.paragraph import Paragraph


MATH_CHARS = set("=+-*/^_()[]{}<>±×÷∑∏∫√∞≈≠≤≥∂∇∈∉∪∩→←↔⇒⇔αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΘΛΠΣΦΨΩ")


def localname(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[1]
    return tag


def normalize_lang_code(lang: str) -> str:
    value = lang.strip().lower()
    value = value.replace("_", "-")
    if value.startswith("zh"):
        return "zh"
    return value


def suggested_output_path(source: Path, target_lang: str) -> Path:
    suffix = normalize_lang_code(target_lang)
    return source.parent / f"{source.stem}.{suffix}.md"


def suggested_source_output_path(source: Path) -> Path:
    return source.parent / f"{source.stem}.original.md"


def clean_inline_text(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    return text.strip()


def iter_docx_blocks(parent: DocxDocument | _Cell):
    if isinstance(parent, DocxDocument):
        parent_elm = parent.element.body
    elif isinstance(parent, _Cell):
        parent_elm = parent._tc
    else:
        raise TypeError(f"Unsupported parent type: {type(parent)!r}")

    for child in parent_elm.iterchildren():
        name = localname(child.tag)
        if name == "p":
            yield Paragraph(child, parent)
        elif name == "tbl":
            yield Table(child, parent)


def first_child(node: Any, name: str) -> Any | None:
    for child in node:
        if localname(child.tag) == name:
            return child
    return None


def child_text(node: Any, name: str) -> str:
    child = first_child(node, name)
    if child is None:
        return ""
    return render_omml(child)


def omml_text_fallback(node: Any) -> str:
    parts = []
    for elem in node.iter():
        if localname(elem.tag) == "t" and elem.text:
            parts.append(elem.text)
    return "".join(parts).strip()


def braced(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    return "{" + value + "}"


def render_omml(node: Any) -> str:
    name = localname(node.tag)

    if name in {"oMath", "oMathPara", "e", "num", "den", "sub", "sup", "deg", "lim"}:
        return "".join(render_omml(child) for child in node)

    if name == "r":
        text = "".join(render_omml(child) for child in node)
        return text or omml_text_fallback(node)

    if name == "t":
        return node.text or ""

    if name == "f":
        num = child_text(node, "num")
        den = child_text(node, "den")
        return f"\\frac{braced(num)}{braced(den)}"

    if name == "rad":
        deg = child_text(node, "deg")
        expr = child_text(node, "e")
        if deg:
            return f"\\sqrt[{deg}]{{{expr}}}"
        return f"\\sqrt{{{expr}}}"

    if name == "sSup":
        base = child_text(node, "e")
        sup = child_text(node, "sup")
        return f"{base}^{braced(sup)}"

    if name == "sSub":
        base = child_text(node, "e")
        sub = child_text(node, "sub")
        return f"{base}_{braced(sub)}"

    if name == "sSubSup":
        base = child_text(node, "e")
        sub = child_text(node, "sub")
        sup = child_text(node, "sup")
        return f"{base}_{braced(sub)}^{braced(sup)}"

    if name == "limLow":
        base = child_text(node, "e")
        lim = child_text(node, "lim")
        return f"{base}_{braced(lim)}"

    if name == "limUpp":
        base = child_text(node, "e")
        lim = child_text(node, "lim")
        return f"{base}^{braced(lim)}"

    if name == "bar":
        expr = child_text(node, "e")
        return f"\\overline{{{expr}}}"

    if name == "func":
        fname = child_text(node, "fName")
        expr = child_text(node, "e")
        return f"{fname} {expr}".strip()

    if name == "fName":
        return "".join(render_omml(child) for child in node)

    if name == "d":
        beg = ""
        end = ""
        props = first_child(node, "dPr")
        if props is not None:
            beg_node = first_child(props, "begChr")
            end_node = first_child(props, "endChr")
            if beg_node is not None:
                beg = beg_node.attrib.get(next(iter(beg_node.attrib), ""), "")
            if end_node is not None:
                end = end_node.attrib.get(next(iter(end_node.attrib), ""), "")
        expr = child_text(node, "e")
        return f"{beg}{expr}{end}"

    if name == "m":
        rows = []
        for row in node:
            if localname(row.tag) != "mr":
                continue
            cols = [render_omml(cell) for cell in row if localname(cell.tag) == "e"]
            rows.append(" & ".join(cols))
        if rows:
            return "\\begin{matrix} " + " \\\\ ".join(rows) + " \\end{matrix}"
        return omml_text_fallback(node)

    rendered_children = "".join(render_omml(child) for child in node)
    return rendered_children or omml_text_fallback(node)


def render_word_node(node: Any) -> str:
    name = localname(node.tag)

    if name in {"oMath", "oMathPara"}:
        formula = render_omml(node).strip()
        if formula:
            return f"${formula}$"
        raw = omml_text_fallback(node)
        return f"${raw}$" if raw else ""

    if name in {"t", "delText"}:
        return node.text or ""

    if name == "tab":
        return "\t"

    if name in {"br", "cr"}:
        return "\n"

    return "".join(render_word_node(child) for child in node)


def paragraph_kind(paragraph: Paragraph, text: str) -> tuple[str, int | None]:
    style_name = ""
    try:
        style_name = paragraph.style.name or ""
    except Exception:
        style_name = ""

    match = re.search(r"(Heading|标题)\s*([1-6])", style_name, flags=re.IGNORECASE)
    if match:
        return "heading", int(match.group(2))

    stripped = text.strip()
    if re.match(r"^(\d+[\.\)]|[-*•])\s+", stripped):
        return "list_item", None

    return "paragraph", None


def cell_text(cell: _Cell) -> str:
    parts = []
    for block in iter_docx_blocks(cell):
        if isinstance(block, Paragraph):
            text = render_paragraph(block)
            if text:
                parts.append(text)
    return "<br>".join(parts).strip()


def render_paragraph(paragraph: Paragraph) -> str:
    parts = [render_word_node(child) for child in paragraph._p.iterchildren()]
    return clean_inline_text("".join(parts))


def render_table(table: Table) -> str:
    rows = []
    width = 0
    for row in table.rows:
        values = [cell_text(cell).replace("|", "\\|") for cell in row.cells]
        while values and not values[-1]:
            values.pop()
        width = max(width, len(values))
        rows.append(values)

    if not rows or width == 0:
        return ""

    normalized = []
    for row in rows:
        padded = row + [""] * (width - len(row))
        normalized.append(padded)

    header = normalized[0]
    separator = ["---"] * width
    body = normalized[1:] or [[""] * width]

    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(separator) + " |",
    ]
    for row in body:
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def extract_docx(path: Path) -> tuple[list[dict[str, Any]], list[str]]:
    document = Document(str(path))
    blocks: list[dict[str, Any]] = []
    warnings: list[str] = []

    for block in iter_docx_blocks(document):
        if isinstance(block, Paragraph):
            text = render_paragraph(block)
            if not text:
                continue
            block_type, level = paragraph_kind(block, text)
            blocks.append(
                {
                    "type": block_type,
                    "level": level,
                    "text": text,
                    "protected": "$" in text,
                }
            )
        elif isinstance(block, Table):
            table_md = render_table(block)
            if table_md:
                blocks.append(
                    {
                        "type": "table",
                        "level": None,
                        "text": table_md,
                        "protected": False,
                    }
                )

    if not blocks:
        warnings.append("No readable DOCX content was extracted.")

    return blocks, warnings


def looks_like_formula(text: str) -> bool:
    stripped = text.strip()
    if len(stripped) < 2:
        return False

    math_hits = sum(ch in MATH_CHARS for ch in stripped)
    digit_hits = sum(ch.isdigit() for ch in stripped)

    if "=" in stripped and (math_hits >= 1 or digit_hits >= 2):
        return True
    if math_hits >= 3 and digit_hits + len(re.findall(r"[A-Za-z]", stripped)) >= 2:
        return True
    if re.search(r"[A-Za-z]\s*=\s*[-+]?\d", stripped):
        return True
    if "^" in stripped or "_" in stripped:
        return True

    return False


def clean_pdf_block(text: str) -> str:
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    return "\n".join(lines).strip()


def split_pdf_block(text: str) -> list[tuple[str, str]]:
    results: list[tuple[str, str]] = []
    buffer: list[str] = []

    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if looks_like_formula(stripped):
            if buffer:
                results.append(("paragraph", " ".join(buffer)))
                buffer = []
            results.append(("equation", stripped))
        else:
            buffer.append(stripped)

    if buffer:
        results.append(("paragraph", " ".join(buffer)))

    return results


def extract_pdf(path: Path) -> tuple[list[dict[str, Any]], list[str]]:
    doc = fitz.open(path)
    blocks: list[dict[str, Any]] = []
    warnings: list[str] = []

    try:
        for page_index, page in enumerate(doc, start=1):
            page_blocks = page.get_text("blocks", sort=True)
            text_block_count = 0
            for block in page_blocks:
                if len(block) < 7:
                    continue
                x0, y0, x1, y1, text, block_no, block_type = block
                if block_type != 0:
                    continue
                cleaned = clean_pdf_block(text)
                if not cleaned:
                    continue
                text_block_count += 1
                for block_type_name, content in split_pdf_block(cleaned):
                    blocks.append(
                        {
                            "type": block_type_name,
                            "level": None,
                            "text": content,
                            "protected": block_type_name == "equation",
                            "page": page_index,
                        }
                    )
            if text_block_count == 0:
                warnings.append(f"Page {page_index} appears to have no extractable text.")
    finally:
        doc.close()

    if not blocks:
        warnings.append("No readable PDF text was extracted. The PDF may be scanned or image-only.")

    return blocks, warnings


def render_markdown(payload: dict[str, Any]) -> str:
    lines = [
        f"<!-- source_path: {payload['source_path']} -->",
        f"<!-- source_format: {payload['source_format']} -->",
        f"<!-- suggested_output_path: {payload['suggested_output_path']} -->",
    ]

    if payload.get("suggested_source_output_path"):
        lines.append(f"<!-- suggested_source_output_path: {payload['suggested_source_output_path']} -->")

    for warning in payload["warnings"]:
        lines.append(f"<!-- warning: {warning} -->")

    lines.append("")

    for index, block in enumerate(payload["blocks"], start=1):
        attrs = [f"block={index}", f"type={block['type']}"]
        if block.get("level") is not None:
            attrs.append(f"level={block['level']}")
        if block.get("page") is not None:
            attrs.append(f"page={block['page']}")
        if block.get("protected"):
            attrs.append("protected=true")
        lines.append(f"<!-- {' '.join(attrs)} -->")

        if block["type"] == "heading":
            level = max(1, min(int(block.get("level") or 1), 6))
            lines.append("#" * level + " " + block["text"])
        elif block["type"] == "list_item":
            text = re.sub(r"^(\d+[\.\)]|[-*•])\s+", "", block["text"])
            lines.append(f"- {text}")
        elif block["type"] == "table":
            lines.append(block["text"])
        elif block["type"] == "equation":
            lines.append("$$")
            lines.append(block["text"])
            lines.append("$$")
        else:
            lines.append(block["text"])

        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def build_payload(path: Path, target_lang: str, include_source_manuscript: bool = False) -> dict[str, Any]:
    suffix = path.suffix.lower()
    if suffix == ".docx":
        blocks, warnings = extract_docx(path)
        source_format = "docx"
    elif suffix == ".pdf":
        blocks, warnings = extract_pdf(path)
        source_format = "pdf"
    else:
        raise SystemExit(f"Unsupported file type: {path.suffix}")

    return {
        "source_path": str(path.resolve()),
        "source_format": source_format,
        **({"suggested_source_output_path": str(suggested_source_output_path(path.resolve()))} if include_source_manuscript else {}),
        "suggested_output_path": str(suggested_output_path(path.resolve(), target_lang)),
        "warnings": warnings,
        "blocks": blocks,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract DOCX or PDF into normalized Markdown-like text.")
    parser.add_argument("input_file", help="Path to a .docx or .pdf file")
    parser.add_argument("--target-lang", default="zh-CN", help="Used for the suggested output filename suffix")
    parser.add_argument("--format", choices=("markdown", "json"), default="markdown")
    parser.add_argument("--output", help="Optional temporary extraction output path")
    parser.add_argument("--include-source-manuscript", action="store_true", help="Include a source-language manuscript path hint only when the user explicitly requests that deliverable")
    args = parser.parse_args()

    path = Path(args.input_file).expanduser()
    if not path.exists():
        raise SystemExit(f"Input file does not exist: {path}")

    payload = build_payload(path, args.target_lang, args.include_source_manuscript)

    if args.format == "json":
        rendered = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    else:
        rendered = render_markdown(payload)

    if args.output:
        output_path = Path(args.output).expanduser()
        output_path.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
