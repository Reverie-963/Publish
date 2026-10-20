# Output Rules

## Packaging And Navigation

- Follow [同目录文稿与统一导航](../../maintain-html-index/references/layout-and-navigation.md): the translated Markdown and derived HTML reading version beside the original by default, shared `assets/<source-stem>/`, a minimal `index.html` navigation tree with explanatory information maintained in `报告.md` and rendered as `报告.html`. Video manuscripts use this same layout, while their transcription and screenshot workflow remains in the separate video skill.
- Resolve image links from the final Markdown path; move/copy the source directory together with its `assets/` to retain portability. Update existing navigation at task completion and validate source/counterpart/return links.

## Markdown Structure

- Preserve heading depth if it is inferable from the source.
- Keep short standalone titles as headings instead of plain paragraphs.
- Preserve lists as lists.
- Preserve tables as Markdown tables when the layout remains readable.
- If a complex table becomes unreadable in Markdown, use a simplified table plus a short note.
- Deliver the complete translated Markdown (`.zh.md` for Chinese) and its derived `.zh.html` reading page by default. The HTML is not a second translation: generate it from Markdown and keep it synchronized. Keep section order, formulas, visuals, tables, lists, captions, and numbering aligned with the source. Create a `.original.md` companion only on explicit request; keep any extraction draft in temporary working storage.

## Formula Handling

- Preserve formulas before translating surrounding text.
- For files intended for both ChatGPT/Codex and Typora, avoid relying on single-dollar `$...$` inline spans: they can remain literal in a ChatGPT/Codex preview. Use `\(...\)` when the target Typora supports it; otherwise use equivalent Unicode for simple inline notation and display blocks for complex math.
- Use display formulas with opening and closing `$$` each on their own line and a blank line around the block. Keep existing valid display blocks; `\[...\]` is also suitable when both target readers have been checked for that delimiter.
- Typora needs version 1.11 or later and **Markdown → Math → LaTeX delimiters** enabled for `\(...\)` / `\[...\]`. Verify the live option and apply/reload or restart when prompted. Retain support for `$...$` in existing documents. Application settings and software updates require user authorization; a translation request alone is not authorization to upgrade an app.
- Write one literal backslash per LaTeX command or delimiter in the saved Markdown (`\(x_{m+1}=26\)`). JSON/programming string escaping is a transport concern: do not leave doubled delimiter backslashes in the file. Do not enclose rendered formulas in backticks or code fences.
- Keep inline formulas on one line. For table cells, use `\(...\)` and avoid literal Markdown column separators inside math: use `\lvert...\rvert` / `\vert` for absolute values. Put multiline or large equations outside tables and link them from the cell.
- Where compatible delimiters cannot be enabled, use unambiguous Unicode notation such as `10⁻⁴`, `(xₖ, yₖ)`, and `xₘ₊₁ = 26` for simple spans. Put complex math in `$$` blocks rather than losing its structure. Do not abbreviate unsupported subscripts or flatten fractions; keep all operators and exponent scope clear. State this notation choice instead of claiming identical typography. Do not require an application upgrade to deliver a translation.
- Keep symbols, operators, variable names, units, and subscripts unchanged unless the source itself localizes them.
- Prefer conservative preservation over aggressive rewriting when formula structure is uncertain.
- Do not add formula screenshots by default. If formula reconstruction is uncertain, preserve the best Markdown math or verbatim source expression conservatively.

## Image And Crop Handling

- Prefer local cropped images for figures, tables, and screenshots.
- Avoid full-page screenshots in the final Markdown when a meaningful local crop can be produced.
- Place cropped images next to their translated caption or surrounding paragraph.
- Use stable relative links to assets stored beside the Markdown, under `assets/<source-stem>/crops/` for document crops.
- Wrap image destinations containing spaces or parentheses in angle brackets; otherwise Typora may truncate the destination at `)` and show a broken image.
- Inventory meaningful visuals before writing. Count figures, plots, diagrams, screenshots, and image-based tables; distinguish them from tables reconstructed directly in Markdown.
- A translated caption, figure index, or note pointing readers back to the PDF does not preserve the source visual.
- Visually inspect the final crops. Reject crops that omit axes, legends, labels, or part of the caption, and tighten crops that include unrelated body paragraphs.

## Translation Quality

- If a source-language companion is explicitly requested, preserve its original wording without translation, paraphrase, or summary. Do not create such a companion by default.
- Translate meaning, not surface word order.
- Keep terminology consistent across headings, prose, figure captions, and table headers.
- Retain important English terms at first mention when the Chinese term could be ambiguous.
- Avoid machine-literal phrasing. Rewrite into fluent target-language prose while preserving technical meaning.

## Final Checks

- Check that every source section appears in the Markdown output.
- Check translated coverage against the source document, without requiring a delivered English Markdown baseline.
- Only for an explicitly requested source-language companion, check original wording, matching structure, image links, and formula positions.
- Check that formulas are not translated as natural language.
- Preview representative inline, display, and table math in the requested readers when available. Check for exposed delimiters, malformed subscripts/superscripts, and math errors. A LaTeX parser passing does not prove either reader rendered the Markdown; state which reader was actually checked.
- Check that table separators render correctly.
- Check that numbering, references, and units remain intact.
- Check that final Markdown image links point to local crops rather than page-level screenshots unless a full-page image is explicitly justified.
- Run `scripts/validate_markdown_assets.py` with the inventoried minimum image count on every delivered Markdown file. Missing files, broken relative links, or a lower-than-expected image count must fail the final check.

## HTML Reading Versions

Follow [HTML reading pages](html-readers.md). Preserve complete text, images, tables, formula semantics and source order; add a horizontally collapsible heading TOC drawer (initially closed) and one “返回总索引” link inside the article. The closed sidebar leaves the article centered; opening it reserves left-side space and pushes the article right without dimming or blocking the page. No top navigation bar or Markdown-file link. Reports appear as ordinary file leaves in index trees. Default material links are Chinese HTML, the original source file labeled 原文稿, and any verified online entry; hide English Markdown/HTML navigation unless explicitly requested. The report uses the same renderer with `报告.md` as its editable source. Do not replace local Markdown or split pages into separate content copies.
