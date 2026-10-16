'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {checkPackage} = require('./check-package.cjs');

test('packaging detects a missing transitive module before launch', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm6-package-'));
  t.after(() => fs.rmSync(dir, {recursive:true, force:true}));
  fs.writeFileSync(path.join(dir,'main.js'), "require('./key-programming');");
  fs.writeFileSync(path.join(dir,'key-programming.js'), "require('./m6up-commands');");
  for (const name of ['preload.js','renderer.js']) fs.writeFileSync(path.join(dir,name), '');
  assert.throws(() => checkPackage(dir), /m6up-commands/);
  fs.writeFileSync(path.join(dir,'m6up-commands.js'), 'module.exports = {};');
  assert.equal(checkPackage(dir), 5);
});
