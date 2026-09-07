// looks-clean — layer 3: what must NOT be reported.
//
// WHY A SUITE OF ITS OWN. Every other layer measures what the tool finds, and a
// rule can always find more by matching more. Each widening looks reasonable
// when it is written; the cost only shows up in somebody else's repository,
// where a report full of things that are not defects teaches the reader to stop
// opening it. This class of tool has a published precision of 18.1%, so the
// question is not whether it will produce noise but whether a particular kind
// of noise can come back after being removed.
//
// Every case below is a shape that LOOKS like a finding and is not. Two of them
// were real false positives during the build:
//
//   * a handler answering `{ known: false, value: null }` was reported as
//     swallowing the failure, because it never touches its error binding and
//     never logs. It hands the outcome to the caller, which is the better trace
//     and the one rule 2 quotes back as the convention.
//   * a whole file that answers `[]` on every failure was going to be reported
//     four times over. That is a decision about the layer, not a deviation
//     inside it, and a rule that fires there has an opinion of its own — which
//     is what every linter already has and what this one is trying not to be.
//
// THE CONTROLS ARE NOT OPTIONAL. A rule that matches nothing at all passes
// every negative test ever written. So the planted deviations must still be
// found in the same run, and a suite where the negatives pass and the controls
// fail is a broken tool, not a careful one.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CLI = path.join(ROOT, 'bin', 'looks-clean.mjs');
const CONFIG = path.join(HERE, 'fixtures', 'golden.config.json');
const CLEAN = path.join(HERE, 'fixtures', 'clean');
const PLANTED = path.join(HERE, 'fixtures', 'project');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-neg-'));

let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log('  ' + (ok ? 'ok    ' : 'FAIL  ') + name.padEnd(50) + (detail || ''));
};

function scan(dir, extra = []) {
  const snap = path.join(TMP, 'run-' + Math.random().toString(36).slice(2) + '.json');
  const r = spawnSync(process.execPath,
    [CLI, 'scan', dir, ...extra, '--config', CONFIG, '--lang', 'en', '--verbose', '--json', snap],
    { encoding: 'utf8', maxBuffer: 1e9 });
  if (!fs.existsSync(snap)) {
    console.log('  FAIL  the scan of ' + dir + ' wrote no snapshot (exit ' + r.status + ')');
    console.log('        ' + String(r.stderr || r.stdout).trim().split(/[\r\n]+/).slice(-2).join(' | '));
    process.exitCode = 1;
    return null;
  }
  return {
    snap: JSON.parse(fs.readFileSync(snap, 'utf8')),
    out: (r.stdout || '') + (r.stderr || ''),
  };
}

console.log('looks-clean — negatives: what must not be reported\n');

// ---------------------------------------------------------------- the clean tree
const clean = scan(CLEAN);
if (!clean) process.exit(1);

console.log('  a tree with nothing wrong in it');
check('the clean fixture produces no findings at all',
  clean.snap.findings.length === 0,
  clean.snap.findings.length
    ? clean.snap.findings.map(f => f.rule + ' ' + f.file + ':' + f.line).slice(0, 4).join('; ')
    : '0 of ' + (clean.snap.counts.handlers + clean.snap.counts.reads) + ' sites');

// Each file is one shape, and each must be silent for its OWN reason. A file
// that goes quiet for the wrong reason is a coincidence, and coincidences come
// undone.
const CASES = [
  ['service.js', 'handlers that carry the outcome',
    'must not be read as swallowing, nor as a default'],
  ['guarded.js', 'reads that all carry a deadline',
    'three spellings of a time limit, all recognised'],
  ['throwing.js', 'a layer with no deadlines anywhere',
    'a decision about the layer, not a deviation inside it'],
  ['uniform.js', 'a layer that always answers []',
    'no neighbour does it the other way, so there is nothing to deviate from'],
  ['alone.js', 'a read with no neighbours at all',
    'an absence of evidence, not a finding'],
];
for (const [file, what] of CASES) {
  const hits = clean.snap.findings.filter(f => f.file.endsWith(file));
  check(file + ' — ' + what, hits.length === 0,
    hits.length ? hits.map(h => h.rule + ':' + h.line).join(', ') : '');
}

// The silences must be ACCOUNTED FOR, not merely silent. A site nobody judged
// and a site judged fine must not look alike — which is this tool's whole
// subject, and the reason `alone.js` and `uniform.js` are separate cases.
check('the lonely read is passed over for want of neighbours',
  /alone\.js.*only 1 peer/.test(clean.out), '');
check('the uniform layer is passed over for want of a convention',
  /uniform\.js.*nothing to deviate from/.test(clean.out), '');
check('neither silence is left uncounted',
  /passed over for want of neighbours: \d/.test(clean.out) &&
  /every peer does it the same way[^\n]*: \d/.test(clean.out), '');

// ---------------------------------------------------------------- the controls
//
// A tool that has stopped matching anything passes everything above.
console.log('\n  the controls: the planted deviations must still be found');
const planted = scan(PLANTED);
if (!planted) process.exit(1);

const MUST_FIND = [
  ['default-on-error', 'api.js', 'a handler answering [] beside three that do not'],
  ['no-timeout', 'net.js', 'one read with no deadline beside three that have one'],
  ['same-answer', 'store.js', 'a function whose two paths meet'],
  ['swallowed', 'disk.js', 'a handler that keeps nothing'],
];
for (const [rule, file, what] of MUST_FIND) {
  const hit = planted.snap.findings.find(f => f.rule === rule && f.file.endsWith(file));
  check(rule + ' still fires in ' + file, !!hit, hit ? hit.file + ':' + hit.line : what);
}

// And the clean tree and the planted tree must not merely differ by luck: the
// planted one has to say MORE than the clean one about the same kinds of site.
check('the planted tree reports and the clean tree does not',
  planted.snap.findings.length > 0 && clean.snap.findings.length === 0,
  planted.snap.findings.length + ' vs 0');

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }

console.log('\n  ' + (failed ? failed + ' failed' : 'every negative held, and every control still fires'));
if (failed) {
  console.log('\n  A widening that gains a finding by also gaining one of these is not a gain.');
  process.exit(1);
}
