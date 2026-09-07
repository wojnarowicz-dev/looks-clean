// looks-clean — layer 6: the neighbour contract.
//
// WHAT THIS LAYER OWNS. Every finding this tool prints is an arithmetic claim
// about a group: "5 of 7 handlers here carry the outcome, this one does not".
// The golden layer checks that the numbers do not change; this one checks that
// they MEAN anything — that the group is real, that it is big enough to have
// been asked, that the site is genuinely outside it, and that the layer named
// in the sentence is the layer the comparison was actually made in.
//
// It is not the resilience layer in another hat. Resilience asks whether the
// RUN says out loud that it compared nothing. This asks whether each FINDING's
// own claim holds — and a run can be perfectly honest about its silences while
// individual findings quote a population that was never assembled.
//
// THE PROPERTY THAT COST THE MOST. A population that is not load-bearing is
// decoration: if raising the threshold above the group size leaves the finding
// standing, the number in the sentence was never consulted. Case 4 below moves
// the threshold and requires the finding to become a passed-over site — not to
// disappear, which would be the tool committing its own subject matter.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { NEEDS_POPULATION } from '../src/rules/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CLI = path.join(ROOT, 'bin', 'looks-clean.mjs');
const CONFIG = path.join(HERE, 'fixtures', 'golden.config.json');
const PLANTED = path.join(HERE, 'fixtures', 'project');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-pop-'));

let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log('  ' + (ok ? 'ok    ' : 'FAIL  ') + name.padEnd(56) + (detail || ''));
};

function scan(dir, extra = []) {
  const snap = path.join(TMP, 'run-' + Math.random().toString(36).slice(2) + '.json');
  const r = spawnSync(process.execPath,
    [CLI, 'scan', dir, ...extra, '--config', CONFIG, '--lang', 'en', '--verbose', '--json', snap],
    { encoding: 'utf8', maxBuffer: 1e9 });
  if (!fs.existsSync(snap)) throw new Error('no snapshot (exit ' + r.status + ')');
  return {
    snap: JSON.parse(fs.readFileSync(snap, 'utf8')),
    out: (r.stdout || '') + (r.stderr || ''),
  };
}

console.log('looks-clean — the neighbour contract\n');

const MINPOP = 3;
const run = scan(PLANTED, ['--minpop', String(MINPOP)]);
const findings = run.snap.findings;
check('the fixture produces findings to reason about', findings.length > 0,
  findings.length + ' findings');

// ---------------------------------------------------------------- 1. arithmetic
//
// For the three rules that need a population, the group is partitioned: every
// member either does the safe thing or deviates, and nothing is counted twice
// or left out. A finding where safe + odd does not equal peers is quoting two
// different groups in one sentence.
const populated = findings.filter(f => NEEDS_POPULATION[f.rule] || (f.meta.peers || 0) > 0);
const badSum = populated.filter(f => (f.meta.safe || 0) + (f.meta.odd || 0) !== f.meta.peers);
check('safe + deviants = the whole group', badSum.length === 0,
  badSum.length ? badSum.map(f => f.rule + ' ' + f.meta.safe + '+' + f.meta.odd + '≠' + f.meta.peers)[0]
    : populated.length + ' findings');

const tooSmall = findings.filter(f => NEEDS_POPULATION[f.rule] && f.meta.peers < MINPOP);
check('no population rule speaks below the threshold', tooSmall.length === 0,
  tooSmall.length ? tooSmall[0].rule + ' on ' + tooSmall[0].meta.peers : 'threshold ' + MINPOP);

const noConvention = findings.filter(f => NEEDS_POPULATION[f.rule] && (f.meta.safe || 0) < 1);
check('every deviation deviates from somebody', noConvention.length === 0,
  noConvention.length ? noConvention[0].rule + ' with safe=0' : '');

const notOdd = findings.filter(f => (f.meta.odd || 0) < 1);
check('the reported site is itself counted as deviating', notOdd.length === 0,
  notOdd.length ? notOdd[0].rule + ' with odd=0' : '');

// ---------------------------------------------------------------- 2. the layer
const noLayer = populated.filter(f => !f.meta.layer || !f.meta.layerKind);
check('every finding names the layer it compared in', noLayer.length === 0,
  noLayer.length ? noLayer[0].rule + ' ' + noLayer[0].file : '');

// A file-level claim must name the finding's own file; a directory-level claim
// must name a directory the file is inside. A sentence naming a layer the site
// is not in is not checkable by the reader, which is the same as not being true.
const wrongLayer = populated.filter(f => {
  if (f.meta.layerKind === 'file') return f.meta.layer !== f.file;
  if (f.meta.layerKind === 'dir') {
    const d = path.dirname(f.file).replace(/\\/g, '/');
    return f.meta.layer !== (d === '.' ? './' : d + '/');
  }
  return f.meta.layerKind !== 'root';
});
check('the named layer contains the reported site', wrongLayer.length === 0,
  wrongLayer.length ? wrongLayer[0].file + ' vs ' + wrongLayer[0].meta.layer : '');

// ---------------------------------------------------------------- 3. rule 1 alone
//
// Rule 1 may speak without a population, and when it does it must SAY it is
// speaking without one. A bare observation printed in the words of a measured
// deviation is the one thing this tool is not allowed to do.
const swallowed = findings.filter(f => f.rule === 'swallowed');
const misdressed = swallowed.filter(f =>
  (f.meta.peers > 0) !== (f.detail && f.detail.alone === false));
check('rule 1 says whether it had neighbours', misdressed.length === 0,
  misdressed.length ? misdressed[0].file + ':' + misdressed[0].line
    : swallowed.length + ' findings, ' + swallowed.filter(f => f.meta.peers > 0).length + ' with a population');

// ---------------------------------------------------------------- 4. load-bearing
//
// Raise the threshold above every group in the fixture. Every population rule
// must fall silent — and the sites must reappear as passed over, by name.
const strict = scan(PLANTED, ['--minpop', '50']);
const survivors = strict.snap.findings.filter(f => NEEDS_POPULATION[f.rule]);
check('a threshold above every group silences the population rules',
  survivors.length === 0,
  survivors.length ? survivors[0].rule + ' survived at minpop 50' : '0 of ' +
    findings.filter(f => NEEDS_POPULATION[f.rule]).length);
check('and the silenced sites are named as passed over',
  /passed over for want of neighbours: \d/.test(strict.out) &&
  /only \d+ peer\(s\), 50 needed/.test(strict.out),
  (strict.out.match(/passed over for want of neighbours: (\d+)/) || [])[1] + ' sites');

// Rule 1 is the control: it does not need a population, so it must NOT be
// silenced by the same threshold. If it were, the threshold would be doing
// something other than what it says.
check('rule 1 is not silenced by the threshold',
  strict.snap.findings.some(f => f.rule === 'swallowed'),
  strict.snap.findings.filter(f => f.rule === 'swallowed').length + ' still reported');

// ---------------------------------------------------------------- 5. the ladder
//
// Climbing a rung can only ever add neighbours. A wider layer reporting a
// smaller group would mean the rungs are not nested, and the sentence
// "5 of 7 in this directory" would be measuring something other than the
// directory.
const wide = scan(PLANTED, ['--minpop', String(MINPOP), '--layer', 'root']);
let shrank = null;
for (const f of findings) {
  const same = wide.snap.findings.find(g => g.rule === f.rule && g.file === f.file && g.anchor === f.anchor);
  if (same && same.meta.peers < f.meta.peers) { shrank = { f, same }; break; }
}
check('a wider layer never has fewer neighbours', shrank === null,
  shrank ? shrank.f.rule + ' ' + shrank.f.meta.peers + ' -> ' + shrank.same.meta.peers
    : 'file vs root, ' + findings.length + ' findings compared');

// ---------------------------------------------------------------- 6. no overlap
//
// A site cannot be both judged and passed over. The two lists come from the
// same loop, and an entry in both would mean a finding was reported on evidence
// the tool had already declared insufficient.
const reported = new Set(findings.map(f => f.rule + '|' + f.file + '|' + f.line));
const passedOver = [...run.out.matchAll(/^ {3}(\S+):(\d+) {3}\[([a-z-]+)\]/gm)]
  .map(m => m[3] + '|' + m[1] + '|' + m[2]);
const both = passedOver.filter(k => reported.has(k));
check('nothing is both reported and passed over', both.length === 0,
  both.length ? both[0] : passedOver.length + ' passed over, ' + reported.size + ' reported');

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }

console.log('\n  ' + (failed ? failed + ' failed' : 'every finding\'s arithmetic holds'));
if (failed) {
  console.log('\n  A finding quotes a group as its evidence. If the group is not real, the');
  console.log('  finding is an opinion wearing the clothes of a measurement.');
  process.exit(1);
}
