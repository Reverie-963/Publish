---
name: translate-docs-to-markdown
description: Translate local Word, PDF, slide decks, images, and long screenshots into faithful Chinese Markdown with preserved structure, formulas, and visuals. Deliver synchronized HTML through maintain-html-index. Use for complete document translation; source-language Markdown is optional on explicit request. Video transcription belongs to video-to-bilingual-markdown. Translate directly without translation MCPs.
---

# Translate Docs To Markdown

Translate the complete document yourself, without translation MCPs. Preserve source order, meaning and coverage; do not turn translation into a summary or explanation. Read [output-rules.md](references/output-rules.md) for the shared translation, math and visual-quality rules. Video translation reuses those rules while retaining its own transcript and screenshot workflow.

## Deliverables and ownership

- Honor an explicit target language; otherwise infer it from the conversation, defaulting to Simplified Chinese in Chinese conversations.
- Keep the source in place. Save `<source-stem>.zh.md` beside it, or in the user's specified output directory; use `.<lang>.md` for another requested language. Preserve the full stem and activity number. Put relative assets under `assets/<source-stem>/`.
- Do not create new `_翻译/` or `文稿索引/` wrappers or move unrelated materials. Keep extraction drafts and conversion intermediates in temporary working storage.
- Do not create `.original.md` by default. Only an explicit source-language/bilingual manuscript request calls for it; reuse the same assets and check its fidelity. Preserve existing companions. The bilingual-video workflow has its own explicit two-manuscript contract.
- Deliver HTML derived from the Markdown through [maintain-html-index](../maintain-html-index/SKILL.md). That skill owns preview locations, templates, navigation and link validation: new previews go in `.file-index/`; existing sibling `.zh.html` pages use its compatibility interface when maintaining their established links. Do not run both renderers on one manuscript or create a second HTML copy by default.
- Add a source link near the top, outside the translated source content; add only existing index/counterpart links. Do not invent a companion or navigation target.

## 1. Inspect and extract

Inventory source pages/sections and meaningful visuals before translating. Compare the extracted structure with the source, including headings, tables, equations, exercises, code, captions and references. Record the expected visual count in working notes; captions alone do not preserve images.

For DOCX and ordinary PDFs, start with:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/translate-docs-to-markdown/scripts/extract_document.py" /absolute/path/to/file.docx --output /tmp/extracted.md
python3 "${CODEX_HOME:-$HOME/.codex}/skills/translate-docs-to-markdown/scripts/extract_document.py" /absolute/path/to/file.pdf --output /tmp/extracted.md
```

The extractor produces source text, not a translation. `--target-lang` affects the suggested filename only; `--include-source-manuscript` is for an explicitly requested companion. Use unique temporary paths for batches.

- **DOCX:** inspect extracted heading/table structure and Word equations. Extract embedded media from the package; retain meaningful paragraph breaks within cells.
- **PDF:** compare page-local reading order. For meaningful figures, diagrams and image-based tables, extract media or crop the relevant region into `assets/<source-stem>/crops/`. Use a reliable available PDF tool; the extractor does not guarantee image extraction. Full-page images are diagnostic or a documented last resort, not substitutes for available local crops.
- **Images/long screenshots/scanned PDFs:** inspect the image itself and use OCR when needed. Account for the visible area; mark unreadable or truncated content rather than guessing it. Disclose low-confidence extraction before promising completeness.
- **Existing Markdown:** read it directly; skip binary extraction. Preserve its established source identity and asset locations.

## 2. Handle slide decks when applicable

Use full-slide rendered Markdown when slide layout or diagrams matter, especially when the user supplies that format as a reference. On macOS, if PowerPoint is available, prefer exporting a temporary PDF through PowerPoint before rendering.

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/translate-docs-to-markdown/scripts/render_slide_deck_markdown.py" \
  /absolute/path/to/source.ppt \
  --translated-md /absolute/path/to/source.zh.md \
  --output-md /absolute/path/to/source.zh.md \
  --assets-dir /absolute/path/to/assets/source \
  --title "Source Deck Title" \
  --source-label "源 PPT"
```

Use a title, source-file line and one `## 幻灯片 N` section per slide. Place the complete `assets/<source-stem>/slides/slide-XX.png` immediately below its heading, then the translated text. Preserve slide order/count; one full-slide image replaces extraction placeholders and redundant per-object media. This intentional slide layout is an exception to ordinary PDF cropping rules.

## 3. Translate and review

Apply [output-rules.md](references/output-rules.md) block by block. Keep technical commands, code, identifiers, URLs and equation semantics unchanged. Maintain a glossary in working notes for recurring terms across a batch. Process sources one at a time, using the original as the baseline; a polished English companion is not a prerequisite.

Re-read the complete translation against the source. Confirm coverage of sections, tables, appendices, exercise/equation numbers, captions and references; fix extraction artifacts, broken tables, malformed lists and duplicate lines. Do not silently correct uncertain source claims or invent math. An explicitly requested source-language companion also needs original-wording and structural checks.

Inspect final crops or a contact sheet for complete axes, labels, legends and relevant captions. Then validate each delivered manuscript using the inventoried image count (zero when the source has no meaningful images):

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/translate-docs-to-markdown/scripts/validate_markdown_assets.py" /absolute/path/to/source.zh.md --min-images <expected-count>
```

Missing assets or too few images fail delivery. Formula syntax checks do not prove reader compatibility: inspect representative inline, display and table math in available target readers, and state what remains unverified. For slide-image output, also compare section/image counts with the source slide count.

## 4. Render and deliver

Pass the root, affected manuscripts, source mapping, verified online links and established order to `maintain-html-index`. It synchronizes HTML and any required existing navigation; final links should use its live local reader with editing/sync by default, with offline HTML as fallback. Do not reproduce its visual or interaction rules in this skill.

Use [task-work-report](../task-work-report/SKILL.md) only when the task calls for a work report; its trigger, content and update policy are maintained there. Translation and indexing do not themselves require a report.
