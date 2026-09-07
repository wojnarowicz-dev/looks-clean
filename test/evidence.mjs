// looks-clean — layer 7: every citation must be real.
//
// WHY. A finding is worth exactly what its neighbours are worth. The sentence
// "5 of 7 handlers here carry the outcome, this one does not" is only an
// argument if a reader can open the five and see it. Counts cannot catch a bad
// citation: the distribution is identical whether the neighbours quoted are the
// right ones, the wrong ones, or a minifier's output — only the reasons are
// nonsense, and a reason nobody checks is believed.
//
// This project has already shipped one of those. Before generated files were
// skipped, a report cited `supabase-js-2.112.4.js:7` three times as evidence
// about the reader's own code. Every number in that run was correct.
//
// SO THE REASONS ARE RE-DERIVED, not trusted. The findings come from the CLI;
// the properties they claim about their neighbours are recomputed here from the
// parse, and the two must agree.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { collectFiles, readProject } from '../src/collect.mjs';
import { loadConfig } from '../src/config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CLI = path.join(ROOT, 'bin', 'looks-clean.mjs');
const CONFIG = path.join(HERE, 'fixtures', 'golden.config.json');
const PLANTED = path.join(HERE, 'fixtures', 'project');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-ev-'));

let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log('  ' + (ok ? 'ok    ' : 'FAIL  ') + name.padEnd(52) + (detail || ''));
};

function scan(dir, extra = []) {
  const snap = path.join(TMP, 'run-' + Math.random().toString(36).slice(2) + '.json');
  const r = spawnSync(process.execPath,
    [CLI, 'scan', dir, ...extra, '--config', CONFIG, '--lang', 'en', '--json', snap],
    { encoding: 'utf8', maxBuffer: 1e9 });
  if (!fs.existsSync(snap)) throw new Error('no snapshot (exit ' + r.status + ')');
  return JSON.parse(fs.readFileSync(snap, 'utf8')).findings;
}

console.log('looks-clean — evidence\n');

const findings = scan(PLANTED);

// The same tree, parsed here, so a claim can be checked against the source
// rather than against another copy of itself.
const cfg = loadConfig(['--config', CONFIG], PLANTED);
const ir = await readProject(collectFiles(PLANTED, cfg), PLANTED);
const at = (list, file, line) => list.filter(x => x.file === file && x.line === line);

const cited = findings.flatMap(f =>
  ((f.detail && f.detail.neighbours) || []).map(n => ({ finding: f, n })));

check('the findings cite neighbours at all', cited.length > 0, cited.length + ' citations');

// ---------------------------------------------------------------- 1. real lines
const unreal = [];
for (const { n } of cited) {
  const abs = path.join(PLANTED, n.file);
  let lines;
  try { lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/); }
  catch { unreal.push(n.file + ' (unreadable)'); continue; }
  if (n.line < 1 || n.line > lines.length) unreal.push(n.file + ':' + n.line + ' (past the end of the file)');
}
check('every cited file:line exists', unreal.length === 0,
  unreal.length ? unreal.slice(0, 2).join('; ') : cited.length + ' citations');

// ---------------------------------------------------------------- 2. not itself
//
// A site quoted as its own neighbour is a group of one wearing a group's
// clothes.
const selfCited = cited.filter(({ finding, n }) =>
  n.file === finding.file && n.line === finding.line);
check('nothing is cited as its own neighbour', selfCited.length === 0,
  selfCited.length ? selfCited[0].finding.file + ':' + selfCited[0].n.line : '');

// ---------------------------------------------------------------- 3. not generated
const generated = new Set(ir.generated.map(g => g.file));
const fromGenerated = cited.filter(({ n }) => generated.has(n.file));
check('nothing is cited from a generated or bundled file', fromGenerated.length === 0,
  fromGenerated.length ? fromGenerated[0].n.file : generated.size + ' generated file(s) in the tree');

// ---------------------------------------------------------------- 4. the claim
//
// The heart of the layer: each rule claims something specific about the sites
// it quotes, and each of those claims is recomputed from the parse.
const wrong = [];
for (const { finding, n } of cited) {
  if (finding.rule === 'no-timeout') {
    // Quoted as a read of the same family that DOES carry a deadline.
    const reads = at(ir.reads, n.file, n.line);
    if (!reads.length) { wrong.push(n.file + ':' + n.line + ' is not a read at all'); continue; }
    if (!reads.some(r => r.guard)) { wrong.push(n.file + ':' + n.line + ' has no deadline'); continue; }
    if (!reads.some(r => r.family === finding.meta.family))
      wrong.push(n.file + ':' + n.line + ' is a different family');
  } else if (finding.rule === 'default-on-error') {
    // Quoted as a handler whose answer is NOT the ambiguous value.
    const hs = at(ir.handlers, n.file, n.line);
    if (!hs.length) { wrong.push(n.file + ':' + n.line + ' is not an error handler'); continue; }
    if (!hs.some(h => h.effects.rethrows || (h.answer && h.answer.kind !== 'ambiguous')))
      wrong.push(n.file + ':' + n.line + ' answers the ambiguous value too');
  } else if (finding.rule === 'swallowed') {
    // Quoted as a handler that leaves a trace.
    const hs = at(ir.handlers, n.file, n.line);
    if (!hs.length) { wrong.push(n.file + ':' + n.line + ' is not an error handler'); continue; }
    const leaves = h => h.effects.usesBinding || h.effects.logs || h.effects.rethrows ||
      h.effects.assignsErrorTarget || (h.answer && h.answer.kind === 'tagged');
    if (!hs.some(leaves)) wrong.push(n.file + ':' + n.line + ' leaves no trace either');
  } else if (finding.rule === 'same-answer') {
    // Quoted as a function, and not the reported one.
    const fns = at(ir.functions, n.file, n.line);
    if (!fns.length) wrong.push(n.file + ':' + n.line + ' is not a function');
  }
}
check('every citation is what the finding says it is', wrong.length === 0,
  wrong.length ? wrong.slice(0, 2).join('; ') : cited.length + ' claims re-derived');

// ---------------------------------------------------------------- 5. the fix
//
// Rule 3's fix names the mechanism the neighbours use. A fix naming a mechanism
// nobody in the layer actually uses is advice invented rather than observed —
// which is the whole thing this tool is meant not to do.
const timeouts = findings.filter(f => f.rule === 'no-timeout');
const inventedFix = timeouts.filter(f => {
  const named = f.detail.guard;
  return !(f.detail.neighbours || []).some(n =>
    at(ir.reads, n.file, n.line).some(r => r.guard === named));
});
check('the suggested deadline is one a neighbour really uses', inventedFix.length === 0,
  inventedFix.length ? inventedFix[0].detail.guard + ' is used by none of them'
    : timeouts.length + ' fix(es) checked');

// ---------------------------------------------------------------- 6. not empty
const populated = findings.filter(f => (f.meta.peers || 0) > 0);
const uncited = populated.filter(f => !((f.detail && f.detail.neighbours) || []).length);
check('every finding with a population cites at least one of it', uncited.length === 0,
  uncited.length ? uncited[0].rule + ' ' + uncited[0].file + ':' + uncited[0].line
    : populated.length + ' findings');

// ---------------------------------------------------------------- 7. the bundle
//
// Check 3 is vacuous on a tree with no bundles in it, and a vacuous check is
// the shape of a test that has stopped testing. So a bundle is planted: a file
// whose handlers would be perfectly good neighbours if anybody read it.
{
  const dir = path.join(TMP, 'with-bundle');
  fs.mkdirSync(dir, { recursive: true });
  for (const e of fs.readdirSync(PLANTED, { withFileTypes: true }))
    if (e.isFile()) fs.copyFileSync(path.join(PLANTED, e.name), path.join(dir, e.name));
  // One line, the way a bundler emits it, carrying four handlers that answer
  // with the outcome attached — exactly the neighbours rule 2 wants to quote.
  const one = 'function a(sb){return sb.rpc("a").catch(function(){return {ok:false,value:null};});}' +
    'function b(sb){return sb.rpc("b").catch(function(){return {ok:false,value:null};});}' +
    'function c(sb){return sb.rpc("c").catch(function(){return {ok:false,value:null};});}' +
    'function d(sb){return sb.rpc("d").catch(function(){return {ok:false,value:null};});}';
  fs.writeFileSync(path.join(dir, 'vendor-client-2.1.0.js'), one + ' '.repeat(1200) + '\n');

  // --layer dir, so the bundle and the real files land in ONE group. At file
  // level api.js already has four neighbours of its own and never looks
  // outside, so the bundle would go unquoted whether or not it was read — and
  // the check would pass for a reason that has nothing to do with skipping.
  const withBundle = scan(dir, ['--layer', 'dir']);
  const citedBundle = withBundle.flatMap(f => ((f.detail && f.detail.neighbours) || []))
    .filter(n => n.file.includes('vendor-client'));
  check('a planted bundle is never quoted as a neighbour', citedBundle.length === 0,
    citedBundle.length ? citedBundle[0].file + ':' + citedBundle[0].line
      : withBundle.length + ' findings, none citing it');

  const included = scan(dir, ['--layer', 'dir', '--include-generated']);
  const citedNow = included.flatMap(f => ((f.detail && f.detail.neighbours) || []))
    .filter(n => n.file.includes('vendor-client'));
  // The control. If the bundle is invisible even when asked for, check 7 passes
  // for the wrong reason and proves nothing about the skipping.
  check('and it IS quoted once --include-generated asks for it', citedNow.length > 0,
    citedNow.length ? citedNow[0].file + ':' + citedNow[0].line : 'still not read — the check above proves nothing');
}

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }

console.log('\n  ' + (failed ? failed + ' failed' : 'every citation checks out'));
if (failed) {
  console.log('\n  A finding whose reasons are nonsense is worse than no finding: it is');
  console.log('  believed, and the numbers beside it are all correct.');
}
// NOT process.exit(): the parser holds async handles, and exiting from under
// them aborts the process on Windows — which the runner would classify as a
// crash rather than as a layer that failed.
process.exitCode = failed ? 1 : 0;
