---
name: translate-docs-to-markdown
description: Translate local Word, PDF, slide decks, images, and long screenshots into faithful Chinese Markdown with preserved formulas, structure, and visuals. Deliver Chinese Markdown plus a synchronized HTML reading version with a table of contents, retain source files, and use the shared HTML index when navigation is needed. Use maintain-html-index for navigation maintenance. Source-language Markdown is optional only when explicitly requested. The agent translates directly, without translation MCPs.
---

# Translate Docs To Markdown

Translate the document yourself. Do not call translation MCPs or outsource the translation to another tool.

For DOCX and ordinary PDFs, use the bundled extractor first so the document structure is normalized before translating. By default, deliver the complete Chinese Markdown (`<source-stem>.zh.md`) beside the source file and generate its HTML reading version (`<source-stem>.zh.html`) with a table of contents. Markdown is the editable source of truth; HTML is the browser reading version. Preserve the source structure, formulas, visuals, tables, captions, and references.

Do not create or deliver `.original.md` or an English Markdown companion unless the user explicitly asks for it. Any source-text extraction needed for translation stays in temporary working storage, not beside the deliverables. An explicitly requested target language overrides the Chinese default. Existing English/source-language manuscripts are retained unless the user separately requests removal, but hide their Markdown/HTML navigation links by default. “原文稿” in navigation means the actual PDF/Word/source file, not a reconstructed English manuscript.

For slide decks, prefer the rendered-slide format when the user provides an example like "参照这个翻译的形式" or when layout/visual context matters:

- Export/render every slide as a PNG under `assets/<source-stem>/slides/slide-XX.png`.
- Write one translated Markdown file with `# <deck title>（中文翻译）`, a source-file line, a short note, then one `## 幻灯片 N` section per slide.
- Put the full-slide image immediately under each slide heading, then the translated text for that slide.
- Keep technical terms as `中文（English）` at first mention when useful; keep code, registers, protocol names, URLs, formulas, addresses, and machine-readable examples unchanged.

Translate block by block, protect formulas, problem/exercise numbering, technical commands, figure captions, screenshots, and image references, and write the final translated Markdown beside the source file, then update the existing navigation.

## Layout And Shared Navigation

Use [maintain-html-index](../maintain-html-index/SKILL.md) for index creation, maintenance, HTML readers, links, and navigation validation. Standalone navigation requests belong to that skill.

- Keep the source in place. Write the complete `<source-stem>.zh.md` beside it (or in the user’s explicit output directory), preserving its full stem and activity number; group images under `assets/<source-stem>/`.
- Do not create new `_翻译/` or `文稿索引/` wrappers. Do not migrate unrelated material. Follow the shared skill’s safe migration rules only when migration is within scope.
- After translating or revising, pass the root directory, affected manuscripts, source mapping, verified online links, source order to the shared skill. It generates affected HTML readers and reconciles existing navigation; do not duplicate its templates or interaction rules here.
- Keep source-language companions only when already present or explicitly requested. Video transcription and screenshot selection remain in `video-to-bilingual-markdown`.

## Workflow

1. Resolve the target language.

- Use the language explicitly requested by the user.
- If the user does not specify a target language, infer it from the conversation.
- If the conversation is in Chinese and the user only says “翻译”, default to Simplified Chinese.

2. Extract the document before translating.

Run:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/translate-docs-to-markdown/scripts/extract_document.py" /absolute/path/to/file.docx
python3 "${CODEX_HOME:-$HOME/.codex}/skills/translate-docs-to-markdown/scripts/extract_document.py" /absolute/path/to/file.pdf
```

- The extractor produces normalized Markdown-like source text for translation.
- Read the extracted output instead of trying to translate the binary file directly.
- If needed, use `--output /tmp/extracted.md` to materialize the extraction result.
- Use `--target-lang` only to influence the suggested output filename suffix. The extractor does not suggest an English/source-language manuscript by default; use `--include-source-manuscript` only when that companion is explicitly requested.
- Also extract or copy source images/screenshots into `assets/<source-stem>/` beside the source whenever the document contains embedded images that are part of the content. For PDFs, use a reliable PDF image extraction method such as PyMuPDF (`fitz`) when the bundled extractor does not emit assets. Prefer cropping only the meaningful figure/table/screenshot regions, using caption and image/text block coordinates; do not insert full-page screenshots unless the page is itself the intended content or no reliable local crop can be produced. For DOCX, copy embedded media from the document package when needed.
- Do not replace source images/screenshots with bare placeholders. If an image cannot be extracted, explicitly state the limitation and why, but still preserve the figure/screenshot location in the Markdown.
- Before translation, inventory meaningful visual objects (figures, plots, diagrams, screenshots, and image-based tables) from captions and page inspection. Record the expected crop count in working notes. A caption-only entry is not a preserved image.

For slide decks (`.ppt`, `.pptx`) or slide-style PDFs:

- If the source is `.ppt`/`.pptx` and Microsoft PowerPoint is available on macOS, export a temporary PDF through PowerPoint before rendering.
- Render slides to PNG and assemble the final slide-image Markdown with:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/translate-docs-to-markdown/scripts/render_slide_deck_markdown.py" \
  /absolute/path/to/source.ppt \
  --translated-md /absolute/path/to/source.zh.md \
  --output-md /absolute/path/to/source.zh.md \
  --assets-dir /absolute/path/to/assets/source \
  --title "Source Deck Title" \
  --source-label "源 PPT"
```

- Use an intermediate translated Markdown only as working input if needed. Remove temporary extraction/conversion files before delivery unless the user requests them.
- Do not use per-object extracted PPT media as a substitute for the full slide image when the requested form shows a full rendered slide per section.

3. Evaluate extraction quality before translating.

- If the document is a native text PDF or a normal DOCX, proceed.
- If the PDF is scanned, image-based, or the extracted text is badly fragmented, tell the user the result is low-confidence and OCR may be required.
- If formulas were only partially reconstructed, preserve them conservatively instead of inventing new math.

4. Establish the source structure in working storage.

- Use extracted text and the source pages as the structural baseline. Clean extraction artifacts only as needed for faithful translation; a complete polished English Markdown is not a prerequisite.
- Inventory heading levels, lists, tables, formulas, exercise numbers, commands, captions, references, and page-local visual placement against the source.
- Keep extraction drafts in temporary working storage. Only if explicitly requested, reconstruct a source-language Markdown with faithful original wording and shared assets.

5. Translate block by block.

- Translate headings, paragraphs, captions, table cell text, and list items.
- Do not translate formulas, symbolic notation, variable names, code, URLs, citation keys, or reference labels unless the user explicitly asks for that.
- Preserve problem/exercise numbering, formulas, MATLAB or other code commands, figure/table captions, screenshots, and image references. When the source has figures, tables, or screenshots, crop the relevant local region and insert Markdown image links near the corresponding translated captions or surrounding text.
- Keep technical terminology consistent. At first mention, prefer `中文（English）` if the term is specialized and the Chinese rendering could be ambiguous.
- Keep the original structure whenever possible: heading levels, bullet lists, numbered lists, tables, and page-local grouping.
- Keep the translated Markdown aligned with the source document, including visual placement and formula positions. If a source-language companion is explicitly requested, keep it structurally parallel too.

6. Rewrite formulas into Markdown math where feasible.

- Default to a ChatGPT/Typora-compatible profile that works with the user's current readers. Use `$$` on separate lines for display math, with a blank line before and after each block. Single-dollar inline math may appear literally in ChatGPT/Codex previews even when Typora renders it.
- With Typora 1.11 or later and **Markdown → Math → LaTeX delimiters** enabled, use `\(...\)` for inline math. Check the actual version and option before claiming compatibility. Preserve existing dollar-math support for older files. Do not change application settings or upgrade software without the user's authorization.
- If the target Typora cannot support LaTeX delimiters, use unambiguous Unicode for simple inline notation (e.g. `10⁻⁴`, `(xₖ, yₖ)`, `xₘ₊₁ = 26`) and move complex expressions to display blocks; disclose that notation choice. Keep expressions such as `10^{-2t}` in a display block when their scope could be ambiguous. Do not flatten fractions, matrices, or unsupported subscripts into ambiguous plain text. A translation should not depend on an application upgrade by default.
- Read the Formula Handling section in [references/output-rules.md](./references/output-rules.md) for escaping, table formulas, and validation.
- Preserve equation numbering only if it exists in the source.
- If a formula cannot be safely converted to LaTeX-style math, keep the original expression verbatim in a fenced block and mention that it was preserved conservatively.
- Do not add formula screenshots by default. Use Markdown math or conservative verbatim preservation for formulas unless the user explicitly asks for formula images.

7. Write the translated Markdown, generate HTML reading pages, and synchronize navigation.

- Default naming: `source.zh.md`. Use `source.<lang>.md` for an explicitly requested alternative target language.
- Write `source.original.md` only when the user explicitly requests a source-language reconstruction or bilingual Markdown delivery.
- Keep the manuscript filename aligned with the full source stem, including its course number. Link the source and `00 - 文件索引.html`（或既有入口） near the top, outside the source content. Add a counterpart link only if the user explicitly requests it and that manuscript actually exists.
- Keep shared assets in `assets/<source-stem>/`; use `crops/` for local PDF crops and `slides/` for slide renders. Reference them relative to the final Markdown directory.
- If a relative asset path contains spaces or parentheses, wrap the Markdown destination in angle brackets, for example `![caption](<assets/paper(1)/crops/fig-01.png>)`, so Typora and common Markdown parsers do not truncate the path.
- Never overwrite the source file.
- Load [maintain-html-index](../maintain-html-index/SKILL.md) when navigation is needed, to generate affected HTML previews and reconcile file links.
- Reuse the same image assets if an optional source-language companion is requested; do not duplicate them.

8. Perform a quality pass before finishing.

- Re-read the complete translated Markdown against the source document.
- If a source-language companion was explicitly requested, also check faithful original wording and structural correspondence.
- Confirm that no new English/source-language Markdown deliverable was created by default.
- Fix broken tables, malformed list indentation, duplicated lines, and obvious extraction artifacts.
- Check that formulas were not translated as prose.
- Check compatible inline delimiters and representative inline, display and table formulas in the intended readers when available. Syntax validation alone does not establish rendered compatibility; disclose unverified behavior.
- Check that problem/exercise numbers, MATLAB or other code commands, figure/table captions, and image references were not dropped.
- Check that every meaningful source figure/table/screenshot is either referenced by a Markdown image link in the translated Markdown (and any explicitly requested companion) or explicitly accounted for if extraction failed. Placeholder-only image notes are not acceptable when the image asset can be extracted.
- Check that Markdown does not use full-page screenshots as substitutes for local figures/tables/screenshots unless explicitly justified by the source layout.
- Open a contact sheet or representative sample of the final crops and verify that each crop contains the complete visual and caption without unrelated surrounding paragraphs.
- Validate local image links before delivery. Use the visual-object inventory as `--min-images`:

```bash
python3 scripts/validate_markdown_assets.py /absolute/path/to/source.zh.md --min-images <expected-count>
```

- Run the same validator on a source-language companion only when one was explicitly requested.
- Treat a missing image asset, broken relative link, or image count below the inventory as a delivery blocker. Do not claim that images were preserved until the validator passes.
- Check that section titles and table headers are translated consistently.
- Validate HTML heading anchors, image/stylesheet/font targets, source-to-reader coverage, and offline math rendering. Record any untested visual behavior separately from structural validation.
- Final delivery links point to actual generated HTML entries; only include a report if one was independently required and created.
- Confirm navigation reaches each delivered manuscript and all source, counterpart, return and asset links resolve; reconcile changed nodes without duplicate indexes or date-only rewrites.
- For slide-image Markdown, check that the number of `## 幻灯片 N` sections equals the source slide count and every `assets/<source-stem>/slides/slide-XX.png` link exists.

## Output Rules

Read [references/output-rules.md](./references/output-rules.md) when the document contains dense formulas, many tables, or terminology that must remain stable across the whole translation.

## Notes By Format

### DOCX

- Trust the extracted heading hierarchy and tables unless the output is clearly malformed.
- Watch for Word equations. Convert them carefully to Markdown math and keep symbol semantics intact.
- If a table cell contains multiple paragraphs, preserve line breaks inside the cell where reasonable.

### PDF

- Expect weaker structure than DOCX.
- Preserve page-local ordering when reconstructing the Markdown.
- Treat isolated math-heavy lines as formulas, not prose.
- Extract embedded PDF images/screenshots into an asset folder and place image links back into the translated Markdown at the matching page-local positions.
- For PDF figures, tables, and screenshots, crop only the needed region from the page. Use full-page rendered images only as a temporary diagnostic artifact or as a documented last resort, not as the final Markdown image link.
- For image-only or heavily scanned PDFs, explain the limitation before promising a high-quality result.

### PPT / PPTX

- Use rendered-slide Markdown when the deck's layout or diagrams matter, especially for lecture slides.
- Keep only one full-slide screenshot per slide section unless the user asks for cropped figures.
- Remove extraction-only placeholders and per-object media links from the final translated Markdown when the full slide render already preserves the visual.
- Preserve slide order and slide count exactly.

## Batch Processing

- Process files one by one.
- Keep filenames parallel to the originals so the user can match each Markdown file to its source.
- Beside each source file, produce `<source-stem>.zh.md` plus its derived `.zh.html` by default (or the explicitly requested target-language pair); share that directory’s `assets/` container and `00 - 文件索引.html`（或既有入口）.
- If terminology repeats across files, maintain a shared glossary in your working notes while translating the batch.

## Refusal Boundary

- Do not claim perfect formula reconstruction when the source extraction is incomplete.
- Do not silently drop pages, tables, or appendices.
- Do not silently drop screenshots or embedded images from the translated Markdown or an explicitly requested companion, and do not use placeholders or full-page screenshots instead of available extractable or croppable local assets.
- Do not use translation MCPs for this skill.


## 任务报告

不因翻译、归档或生成索引而强制创建报告。任务量较大、存在多项成果或有用户待确认事项时，另行使用 [task-work-report](../task-work-report/SKILL.md)。报告只写已完成和待审核确认，详细来源记录与课程正文单独保留。
