# Screenshot Selection

Use this reference during visual curation. The goal is coverage of meaningful complete pages, not a fixed number of screenshots.

## What to keep

1. Keep the title or topic page when it identifies the lesson.
2. For incrementally revealed slides, keep the last stable frame before the next page transition. It should contain the complete final build.
3. Keep a demonstration state when it persistently shows a meaningful command, output, error, configuration, diagram, or worked example that is not captured by the final slide alone.
4. If a page changes to a distinct example without a major transition, keep the final stable state of each example.
5. Prefer the frame after animations and cursor movement settle. Ensure overlays, menus, subtitles, or popovers do not cover required content unless they are themselves the subject.

## What to remove

- Partial builds superseded by a complete version.
- Fade, wipe, loading, seek, or application-switch transitions.
- Frames changed only by the mouse pointer, presenter webcam motion, clock, or compression noise.
- Near-duplicates that communicate the same information.
- Blank screens and purely decorative outro logos, unless they contain required credits or references.

## Coverage check

Inspect a low-frequency whole-video contact sheet in addition to the selected-frame contact sheet. Compare the page sequence from start to finish and account for every major page transition. For videos with live software demonstrations, also scrub the periods where the transcript contains commands, results, errors, or phrases such as “as you can see” and “here is the output.”

The automatic detector uses full-frame visual change. It can miss small but important terminal, code, or table updates. Add those states manually when the transcript or visual review shows that they matter.
