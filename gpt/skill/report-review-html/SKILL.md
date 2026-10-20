---
name: report-review-html
description: Create bilingual HTML review editions of reports and other prose when the user asks for an 审核版, 审阅版, review edition, or revision comparison. Use a simple per-paragraph version history on the left and a directly editable new version on the right; feedback uses GPT native annotations. Do not activate for ordinary final reports or code review alone.
---

# HTML Review Editions

For assistant task completion summaries (what was done and what needs user confirmation), use `task-work-report` instead. This skill remains for revising authored prose.

Create the review in the user's writing folder, separate from submission materials. Follow the established navigation and purple accent palette. Ground claims in the actual sources and saved results.

## Paragraph versions

- The user's latest report is v1, shown on the left. Never substitute an older report or invent a weaker “before” passage. Preserve previous files in a recoverable archive when changing the review format.
- Each logical paragraph/section has an independent version dropdown on the left. The right-hand English and Chinese fields start empty and are directly editable. “保存本段” appends an immutable version, selects it on the left, and clears the right-hand draft. Do not overwrite earlier versions.
- A blank language field inherits that language from the selected left version. Explain this next to the save button. Both fields blank or identical content must not create a duplicate version.
- Changing the selected version must preserve the draft. Save the selected parent ID when making a version from older text. Persist history, selection and unfinished drafts in browser storage, keyed by document ID; handle storage failures without falsely claiming durable saving.
- Keep only the requested global “前后对照／阅读稿” view switch. The reading view shows the draft with any unchanged language inherited, or the selected left version when the draft is empty. Keep alternating English paragraph then Chinese paragraph, unless the user requests another arrangement.
- Show deletions in red and additions in green while editing, with explicit before/after labels and an accessible plain textarea. Do not treat an empty new draft as deletion of all existing text.

## Feedback and simplicity

The user uses GPT native annotations for review feedback. Do not add JSON import/export, accept/reject/pending decisions, a separate review-comment field, approval counters, filters, export buttons or a collapsed “edit this paragraph” control. Do not require the user to transfer a review-record file.

Explain the flow briefly: select a left version → write on the right → save this paragraph → the saved text becomes a new left version. Native annotations sent in the conversation guide the assistant's next edits. Browser state is not automatically written to the source file or automatically readable by the assistant; state this simply, without promising synchronization. Do not bypass browser access restrictions to retrieve local state.

When migrating from the older review UI, preserve current edited English/Chinese text from its matching local browser state as the new starting content when available. Retain the old record; ignore its decision statuses. Do not restore the removed controls.

## Renderer and source maintenance

Run `scripts/build_review.py INPUT.json OUTPUT.html`. This standard-library Python renderer bundles `assets/review.css` and `assets/review.js` into the page. JSON remains an internal authoring format, not a user-facing handoff mechanism.

Source fields:
- `id`, `revision`, `title`, `back_href`; optional `legacy_revision` for migration from the older UI.
- `blocks`: stable `id`, `title`, `versions`, `evidence`, optional `tables` and `figures`.
- Each version: immutable unique `id`, `en`, `zh`; optional `parentId` and `createdAt`. UI numbers v1, v2, etc. follow list order. For the first version use the current agreed/latest draft.
- `tables`: `caption`, `headers`, `rows`. `figures`: local relative `src` and `caption`.

When responding to native feedback, append a new version to the affected source block with a fresh ID and preserve earlier content and unaffected blocks. Never change content under an existing version ID. The page merges new source IDs with saved browser history and retains drafts. If browser-only text is not present in the supplied annotation, do not pretend to have read it; use the text provided or ask for only the missing passage.

Keep full tables, figures, formulas and sources. Text versioning does not silently version tables/figures; if those are changed, give them explicit versioned counterparts or extend the data model for that requested change. Preserve original evidence and distinguish numerical checks from new experiments.

## Final template

Once the user supplies a final template, transfer agreed content into it with its formatting. Remove review colors and controls from the final submission. If the template is absent, complete the review page and leave template filling for that later step. Do not submit or publish anything.

## Verification

Check latest-draft-to-v1 fidelity, language pairing, links/assets and JavaScript syntax. Exercise saving v2/v3, history selection, draft persistence, reload, inherited language, duplicate prevention, new-source-version merge, migration, safe text rendering and storage failure with a DOM test runtime. Use a real browser preview only when permitted; distinguish simulated interaction checks from visual validation. Validate the skill structure after updates.
