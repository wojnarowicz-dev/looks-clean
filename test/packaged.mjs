// looks-clean — layer 11: the tool as the reader receives it.
//
// EVERY OTHER LAYER RUNS THE CLONE. None of them runs the package, and those
// are two different programs wherever `files` in package.json disagrees with
// what the code needs at runtime. The disagreement is silent by construction:
// a missing file does not make the clone fail, because the clone has it.
//
// THIS WAS A REAL UNCERTAINTY, NOT A THEORETICAL ONE. src/parser.mjs computes
// the grammar path as `new URL('../vendor/…', import.meta.url)` — relative to
// itself. In the clone that resolves always. In the package it resolves only
// if vendor/ actually travelled beside src/. At 0.3.0 that was checked by
// hand, once, and nothing would have caught it changing.
//
// WHAT IT COMPARES, and why not a list of expected findings. A hard-coded
// expectation drifts with the fixture and has to be re-blessed, and a
// re-blessing is where a real regression hides. So the same directory is
// scanned TWICE — once by the clone, once by the installed package — and the
// two runs must agree, finding for finding. The clone is already held to the
// truth by nine other layers; this layer only has to prove the package is the
// same program.
//
// THE DART HALF IS THE POINT. Losing the grammar does not raise an error: a
// file that cannot be parsed contributes nothing, and the tool reports a
// clean tree. So the Dart findings are asserted by name as well as by the
// comparison — a layer that only diffed totals could be satisfied by two runs
// that both saw nothing.
//
// A SKIP IS NOT A PASS. Installing a tarball needs the three dependencies, and
// that needs the network or a warm cache. When it cannot be done the layer
// says so and exits 2, because "the package was never installed" and "the
// package works" must not look alike.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CLI = path.join(ROOT, 'bin', 'looks-clean.mjs');
const CONFIG = path.join(HERE, 'fixtures', 'golden.config.json');
const MATERIAL = path.join(HERE, 'fixtures', 'packaged');

let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log('  ' + (ok ? 'ok    ' : 'FAIL  ') + name.padEnd(52) + (detail || ''));
};

const skip = (why, detail) => {
  console.log('  SKIP  ' + why);
  if (detail) console.log('        ' + String(detail).trim().split(/[\r\n]+/).slice(-3).join(' | '));
  console.log('\n  The package was never installed, so this run proves nothing about it.');
  console.log('  That is not the same as its passing, and the exit code says so.');
  process.exit(2);
};

console.log('looks-clean — the tool as the reader receives it\n');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-pack-'));
const cleanup = () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* a temp dir left behind harms nothing */ } };

/** Runs a scan and returns the findings, reduced to what a reader would act on. */
function scan(cli, label) {
  const snap = path.join(tmp, 'run-' + label + '.json');
  const r = spawnSync(process.execPath,
    [cli, 'scan', MATERIAL, '--config', CONFIG, '--lang', 'en', '--json', snap],
    { cwd: tmp, encoding: 'utf8', maxBuffer: 1e9 });
  if (!fs.existsSync(snap)) {
    return { error: 'wrote no snapshot (exit ' + r.status + ')\n' + (r.stderr || r.stdout || '') };
  }
  const run = JSON.parse(fs.readFileSync(snap, 'utf8'));
  return {
    findings: run.findings.map(f => f.rule + ' | ' + f.file + ':' + f.line + ' | ' + f.label).sort(),
    counts: run.counts,
  };
}

// ------------------------------------------------------------------ the clone
const clone = scan(CLI, 'clone');
if (clone.error) {
  console.log('  FAIL  the clone could not scan its own fixture     ' + clone.error.split('\n')[0]);
  cleanup();
  process.exit(1);
}
check('the clone reports something to compare against', clone.findings.length > 0,
  clone.findings.length + ' finding(s)');

// -------------------------------------------------------------- pack, install
const packed = spawnSync('npm', ['pack', '--pack-destination', tmp],
  { cwd: ROOT, encoding: 'utf8', shell: true, maxBuffer: 1e9 });
const tarball = fs.readdirSync(tmp).find(f => f.endsWith('.tgz'));
if (!tarball) skip('npm pack produced no tarball', packed.stderr || packed.stdout);
check('npm pack produced a tarball', true, tarball);

const home = path.join(tmp, 'install');
fs.mkdirSync(home, { recursive: true });
fs.writeFileSync(path.join(home, 'package.json'),
  JSON.stringify({ name: 'lc-packaged-check', version: '1.0.0', private: true }, null, 2));

const installed = spawnSync('npm',
  ['install', '--no-audit', '--no-fund', '--prefer-offline', '--ignore-scripts',
    path.join(tmp, tarball)],
  { cwd: home, encoding: 'utf8', shell: true, maxBuffer: 1e9 });

const packageCli = path.join(home, 'node_modules', 'looks-clean', 'bin', 'looks-clean.mjs');
if (!fs.existsSync(packageCli)) {
  cleanup();
  skip('the tarball would not install — no network and no warm cache?',
    installed.stderr || installed.stdout);
}
check('the tarball installs', true, 'node_modules/looks-clean');

// ---------------------------------------------------------- the package itself
// WHAT SHIPPED, read off the installed copy rather than off `files`. Asking
// package.json what it includes is asking the same sentence that would be
// wrong; asking the unpacked directory is asking what arrived.
const pkgDir = path.join(home, 'node_modules', 'looks-clean');
const record = JSON.parse(fs.readFileSync(path.join(ROOT, 'vendor', 'grammars.json'), 'utf8'));
const row = record.grammars.find(g => g.language === 'dart');
const shipped = path.join(pkgDir, 'vendor', row.file);

check('the carried grammar shipped', fs.existsSync(shipped),
  fs.existsSync(shipped) ? 'vendor/' + row.file : 'MISSING from the package');

if (fs.existsSync(shipped)) {
  const bytes = fs.readFileSync(shipped);
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  check('and arrived byte for byte', sha === row.sha256 && bytes.length === row.bytes,
    sha === row.sha256 ? bytes.length + ' bytes'
      : 'sha256 ' + sha.slice(0, 16) + '… vs ' + row.sha256.slice(0, 16) + '…');
}

// ------------------------------------------------------------- the same program
const fromPackage = scan(packageCli, 'package');
if (fromPackage.error) {
  check('the package scans the fixture', false, fromPackage.error.split('\n')[0]);
} else {
  const a = clone.findings, b = fromPackage.findings;
  const gone = a.filter(x => !b.includes(x));
  const extra = b.filter(x => !a.includes(x));
  check('the package finds what the clone finds', gone.length === 0 && extra.length === 0,
    gone.length || extra.length ? '-' + gone.length + ' +' + extra.length
      : b.length + ' finding(s), identical');
  for (const x of gone.slice(0, 4)) console.log('        only in the clone:   ' + x.slice(0, 90));
  for (const x of extra.slice(0, 4)) console.log('        only in the package: ' + x.slice(0, 90));

  // Every count too: a package that read half the files and found the same
  // things in the half it read is not the same program.
  const differing = Object.keys(clone.counts)
    .filter(k => clone.counts[k] !== fromPackage.counts[k]);
  check('and counts what the clone counts', differing.length === 0,
    differing.length ? differing.map(k => k + ' ' + clone.counts[k] + ' vs ' + fromPackage.counts[k]).join(', ')
      : Object.keys(clone.counts).length + ' counters');

  // NAMED, NOT INFERRED. A lost grammar reports a clean tree rather than an
  // error, so both runs agreeing on nothing would pass everything above.
  const dartHalf = b.filter(x => x.includes('.dart:'));
  const jsHalf = b.filter(x => x.includes('.js:'));
  check('the package read the Dart half', dartHalf.length > 0,
    dartHalf.length ? dartHalf[0].slice(0, 60) : 'no Dart finding — did the grammar travel?');
  check('the package read the JavaScript half', jsHalf.length > 0,
    jsHalf.length ? jsHalf[0].slice(0, 60) : 'no JavaScript finding');
}

cleanup();
console.log('\n  ' + (failed ? failed + ' failed' : 'the package is the same program as the clone'));
process.exit(failed ? 1 : 0);
