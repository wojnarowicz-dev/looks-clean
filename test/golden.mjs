// looks-clean — golden tests: a full run over a fixture tree, its --json output
// compared field by field with a recorded expectation.
//
// WHAT IS COMPARED. Everything the snapshot holds except the two fields that
// cannot be stable: `createdAt`, and `root` (an absolute path on this machine).
// THE FINGERPRINTS ARE COMPARED TOO. Counts alone would call a run identical
// after a change that left every number where it was and moved every id — and
// the ids are what the diff between runs rests on.
//
//     node test/golden.mjs            check
//     node test/golden.mjs --update   re-record the expectations
//
// EVERY CASE PINS --config, and that is not decoration. loadConfig() looks for
// .looks-clean.json in the scanned directory and then in the CURRENT WORKING
// DIRECTORY, so this repository's own config — which excludes test/fixtures so
// that `npm run self-check` does not report the bait planted there — would reach
// into the golden runs and empty every one of them: "No files found", exit 0,
// no snapshot. A golden test that changes its verdict because of a file
// somewhere above it is measuring the machine, not the tool.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CLI = path.join(ROOT, 'bin', 'looks-clean.mjs');
const GOLD = path.join(HERE, 'golden');
const UPDATE = process.argv.includes('--update');

// EVERY CASE PINS THIS CONFIG, and since the defaults grew a test-code
// exclusion it does more than shield the run from the repository's own
// .looks-clean.json. The fixtures live under test/ on purpose — that is where
// fixtures go — and the default exclusions now skip exactly that. So the
// fixture config turns the defaults OFF: these directories hold nothing a
// default exclusion protects against, and a suite that could not read its own
// material would be the loudest possible instance of this tool's own subject.
const CONFIG = 'test/fixtures/golden.config.json';

// Thresholds are pinned per case on purpose: a golden test must not change its
// verdict because a default moved. Measuring the effect of a moved default is
// what the runs against real projects are for.
const CASES = [
  { name: 'all', args: ['scan', 'test/fixtures/project', '--minpop', '3'] },
  { name: 'layer-root', args: ['scan', 'test/fixtures/project', '--layer', 'root', '--minpop', '4'] },
  { name: 'one-rule', args: ['scan', 'test/fixtures/project', '--rule', 'no-timeout'] },
  { name: 'page', args: ['scan', 'test/fixtures/page', '--minpop', '3'] },
].map(c => ({ ...c, args: [...c.args, '--config', CONFIG] }));

const slash = s => String(s).split(path.sep).join('/');

/** Drops what cannot be stable between machines and runs; keeps everything else. */
function normalise(snap) {
  const { createdAt, root, ...rest } = snap;
  return {
    ...rest,
    root: slash(path.relative(ROOT, root)) || '.',
    findings: (rest.findings || []).map(f => ({ ...f, file: slash(f.file) })),
  };
}

/** Field-level difference, so a failure says WHAT moved rather than "not equal". */
function differences(a, b, prefix = '') {
  const out = [];
  const keys = [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])];
  for (const k of keys) {
    const x = a ? a[k] : undefined, y = b ? b[k] : undefined;
    const p = prefix ? prefix + '.' + k : k;
    const obj = v => v && typeof v === 'object' && !Array.isArray(v);
    if (obj(x) && obj(y)) { out.push(...differences(x, y, p)); continue; }
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) out.push(p + ': ' + x.length + ' entries -> ' + y.length);
      const n = Math.min(x.length, y.length);
      for (let i = 0; i < n; i++) {
        if (obj(x[i]) && obj(y[i])) out.push(...differences(x[i], y[i], p + '[' + i + ']'));
        else if (JSON.stringify(x[i]) !== JSON.stringify(y[i]))
          out.push(p + '[' + i + ']: ' + JSON.stringify(x[i]) + ' -> ' + JSON.stringify(y[i]));
      }
      continue;
    }
    if (JSON.stringify(x) !== JSON.stringify(y))
      out.push(p + ': ' + JSON.stringify(x) + ' -> ' + JSON.stringify(y));
  }
  return out;
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-golden-'));
fs.mkdirSync(GOLD, { recursive: true });

let failed = 0, updated = 0, passed = 0;
console.log('looks-clean — golden tests\n');

for (const c of CASES) {
  // A FRESH snapshot path every time. The scan diffs against whatever the file
  // already holds, so reusing one would make the result depend on the order the
  // cases ran in.
  const out = path.join(TMP, c.name + '.json');
  const r = spawnSync(process.execPath, [CLI, ...c.args, '--lang', 'en', '--json', out],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1e9 });

  if (!fs.existsSync(out)) {
    console.log('  FAIL  ' + c.name.padEnd(11) + 'no snapshot written (exit ' + r.status + ')');
    console.log('        ' + String(r.stderr || r.stdout).trim().split(/[\r\n]+/).slice(-3).join(' | ').slice(0, 200));
    failed++;
    continue;
  }

  const got = normalise(JSON.parse(fs.readFileSync(out, 'utf8')));
  const expFile = path.join(GOLD, c.name + '.json');

  if (UPDATE || !fs.existsSync(expFile)) {
    const had = fs.existsSync(expFile);
    const before = had ? JSON.parse(fs.readFileSync(expFile, 'utf8')) : null;
    fs.writeFileSync(expFile, JSON.stringify(got, null, 2) + '\n');
    const d = had ? differences(before, got) : [];
    console.log('  ' + (had ? 'UPDATED' : 'RECORDED').padEnd(8) + c.name.padEnd(11) +
      got.findings.length + ' findings' + (had && d.length ? '  (' + d.length + ' fields changed)' : ''));
    for (const line of d.slice(0, 10)) console.log('          ' + line);
    updated++;
    continue;
  }

  const exp = JSON.parse(fs.readFileSync(expFile, 'utf8'));
  const d = differences(exp, got);
  if (d.length === 0) {
    console.log('  PASS  ' + c.name.padEnd(11) + got.findings.length + ' findings, fingerprints identical');
    passed++;
  } else {
    console.log('  FAIL  ' + c.name.padEnd(11) + d.length + ' field(s) differ from ' +
      slash(path.relative(ROOT, expFile)));
    for (const line of d.slice(0, 12)) console.log('          ' + line);
    if (d.length > 12) console.log('          ... and ' + (d.length - 12) + ' more');
    failed++;
  }
}

// ---------------------------------------------------------------- the planted four
//
// The recordings above catch ANY change. This block says what must be true
// whatever else moves: each of the four planted deviations is still found, and
// still by the rule it was planted for. A recording can be updated by mistake;
// this cannot, without deleting a line that names the defect.
const PLANTED = [
  { rule: 'default-on-error', file: 'api.js', anchor: /^sb\.rpc->\[\]$/ },
  { rule: 'no-timeout', file: 'net.js', anchor: /^fetch@saveProfile$/ },
  { rule: 'same-answer', file: 'store.js', anchor: /^readEntries=\[\]$/ },
  { rule: 'swallowed', file: 'disk.js', anchor: /readManifest/ },
];
{
  const out = path.join(TMP, 'planted.json');
  spawnSync(process.execPath,
    [CLI, 'scan', 'test/fixtures/project', '--config', CONFIG, '--lang', 'en', '--json', out],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1e9 });
  const found = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')).findings : [];
  console.log('');
  for (const p of PLANTED) {
    const hit = found.find(f => f.rule === p.rule && slash(f.file).endsWith(p.file) && p.anchor.test(f.anchor));
    console.log('  ' + (hit ? 'PASS  ' : 'FAIL  ') + 'planted ' + p.rule.padEnd(17) +
      (hit ? p.file + ':' + hit.line : 'NOT FOUND in ' + found.length + ' findings'));
    if (hit) passed++; else failed++;
  }
}

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }

console.log('\n  ' + passed + ' passed, ' + failed + ' failed' + (updated ? ', ' + updated + ' recorded' : ''));
if (failed) {
  console.log('\n  A recorded run changed. Either the change is wrong, or the recording is\n' +
    '  out of date — decide which before running --update.');
  process.exit(1);
}
