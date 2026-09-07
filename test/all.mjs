// looks-clean — every layer, in order of how cheaply it fails.
//
// ONE RUNNER, NOT TEN COMMANDS, because a suite people have to remember to run
// is a suite that stops being run. Each layer keeps its own exit code, and the
// summary distinguishes the three outcomes that must never look alike:
//
//   passed    the layer ran and everything held
//   FAILED    the layer ran and something is wrong          -> exit 1
//   skipped   the layer could not reach its material        -> exit 2
//
// A SKIPPED LAYER IS NOT A PASSING LAYER, and the exit code says so. On this
// repository `known-answers` always skips at least one row — the migration
// checker is not JavaScript and this build reads JavaScript — so a clean run of
// the whole suite exits 2, not 0. That is not a defect to be tidied away: it is
// the tool's own rule applied to its own tests, and a suite that exited 0 there
// would be reporting "checked and fine" over material it never opened.
//
// THE ORDER IS DELIBERATE. The structural checks run first, so a broken
// dictionary is reported in a second rather than after two minutes of parsing.
// The layers that reach outside the repository run last.
//
// THE LIST IS EXPLICIT, not read off the directory. A layer file deleted by
// accident has to fail here; discovering the layers would make its removal
// invisible, which is this project's subject in its own test runner.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const LAYERS = [
  ['vocabulary', 'the tables the rules see through'],
  ['lang-check', 'the two message languages are two languages'],
  ['negative', 'what must not be reported'],
  ['golden', 'recorded runs, field by field'],
  ['amplify', 'the output depends on the input'],
  ['population', 'every finding\'s arithmetic holds'],
  ['evidence', 'every citation is real'],
  ['resilience', 'fail loudly, never quietly'],
  ['readme', 'the README agrees with the tool'],
  ['known-answers', 'the six hand-traced defects'],
];

const missing = LAYERS.filter(([n]) => !fs.existsSync(path.join(HERE, n + '.mjs')));
if (missing.length) {
  console.log('looks-clean — test layers\n');
  for (const [n] of missing) console.log('  MISSING  test/' + n + '.mjs');
  console.log('\n  A layer named here and absent on disk is a layer nobody is running.');
  process.exit(1);
}

console.log('looks-clean — ' + LAYERS.length + ' test layers\n');

const rows = [];
for (const [name, what] of LAYERS) {
  const r = spawnSync(process.execPath, [path.join(HERE, name + '.mjs')],
    { encoding: 'utf8', maxBuffer: 1e9 });
  const out = (r.stdout || '') + (r.stderr || '');
  rows.push({ name, what, status: r.status, out });
  const state = r.status === 0 ? 'pass' : r.status === 2 ? 'SKIP' : 'FAIL';
  console.log('  ' + state.padEnd(6) + name.padEnd(16) + what);
  if (r.status !== 0)
    for (const line of out.trim().split(/\r?\n/).slice(-6)) console.log('         ' + line);
}

const failed = rows.filter(r => r.status !== 0 && r.status !== 2);
const skipped = rows.filter(r => r.status === 2);
console.log('\n  ' + (rows.length - failed.length - skipped.length) + ' passed, ' +
  failed.length + ' failed' + (skipped.length ? ', ' + skipped.length + ' skipped' : '') +
  '   (' + rows.length + ' layers)');

if (failed.length) process.exit(1);
if (skipped.length) {
  console.log('\n  A layer that could not reach its material is not a passing layer.');
  process.exit(2);
}
