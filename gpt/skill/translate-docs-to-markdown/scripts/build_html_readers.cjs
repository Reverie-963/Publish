#!/usr/bin/env node
'use strict';
// Compatibility entrypoint; the shared skill owns the renderer and dependencies.
const fs = require('fs');
const path = require('path');
const entry = path.resolve(__dirname, '../../maintain-html-index/scripts/build_html_readers.cjs');
if (!fs.existsSync(entry)) {
  throw new Error('Install maintain-html-index beside translate-docs-to-markdown before building HTML readers.');
}
require(entry);
