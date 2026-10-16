'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');

// Check the packaged files, not the source tree: a missing runtime module must
// fail the build before a broken executable is handed to the user.
function checkPackage(directory) {
  const seen = new Set();
  function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.(?:js|cjs)$/.test(file)) return;
    const source = fs.readFileSync(file, 'utf8');
    const resolve = createRequire(file).resolve;
    for (const match of source.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      visit(resolve(match[1]));
    }
  }
  for (const entry of ['main.js', 'preload.js', 'renderer.js']) {
    visit(path.resolve(directory, entry));
  }
  return seen.size;
}
module.exports = {checkPackage};
