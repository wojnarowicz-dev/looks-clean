// looks-clean — the scan: read the tree, run the four rules, report.
//
// THE HEADER IS NOT DECORATION. Every number in it exists so that a run with no
// findings can be told apart from a run that found nothing to look at:
// files read, functions, handlers, reads, how many sites were passed over for
// want of neighbours, and how many files failed to parse. A tool whose empty
// answer looks identical to its clean answer would be the exact defect it
// reports, shipped.
//
// The rules are run in a fixed order and their findings are sorted before the
// snapshot is built, so two runs over the same tree produce byte-identical
// output. That is what makes the golden tests worth anything.
import path from 'node:path';
import { t } from './lang.mjs';
import { makeFlag, hasFlag, valueOf } from './args.mjs';
import { reportNonUtf8, reportUnreadable, unreadableFiles } from './input.mjs';
import { collectFiles, readProject } from './collect.mjs';
import { noSourcesIn, noPopulation } from './population.mjs';
import { prepare, diffHeader, resultExit } from './snapshot.mjs';
import { score } from './rank.mjs';
import { loadConfig } from './config.mjs';

import { RULES, RULE_IDS } from './rules/index.mjs';

const argv = process.argv.slice(2);
const ROOT = argv[0];
const flag = makeFlag(argv);
const TOP = Math.max(1, +flag('top', 15) || 15);
const MINPOP = Math.max(2, +flag('minpop', 3) || 3);
const VERBOSE = hasFlag(argv, 'verbose');

const LAYER = String(flag('layer', 'file'));
if (LAYER !== 'file' && LAYER !== 'dir' && LAYER !== 'root') {
  console.error(t('unknownLayer', LAYER));
  process.exit(2);
}

const only = valueOf(argv, 'rule');
let selected = RULES;
if (only) {
  const wanted = String(only).split(',').map(s => s.trim());
  const bad = wanted.filter(w => !RULE_IDS.includes(w));
  if (bad.length) {
    console.error(t('unknownRule', bad.join(', '), RULE_IDS.join(', ')));
    process.exit(2);
  }
  selected = RULES.filter(r => wanted.includes(r.id));
}

const cfg = loadConfig(argv, ROOT);

// ------------------------------------------------------------------ read
const files = collectFiles(ROOT, cfg);
{
  const missing = noSourcesIn(files.script.length + files.html.length, '.js/.ts/.html', ROOT);
  if (missing) {
    console.log(t('scanTitle'));
    console.log(t('root') + ROOT);
    console.log('');
    console.log(missing);
    process.exit(0);
  }
}

const ir = await readProject(files, ROOT, { includeGenerated: hasFlag(argv, 'include-generated') });

// ------------------------------------------------------------------ rules
const ctx = { minpop: MINPOP, layerMode: LAYER };
const findings = [];
const skipped = [];
const perRule = new Map();

for (const rule of selected) {
  const r = rule.run(ir, ctx);
  perRule.set(rule.id, r.findings.length);
  findings.push(...r.findings);
  skipped.push(...r.skipped);
}

// STRENGTH OF EVIDENCE FIRST, AND STILL REPRODUCIBLE.
//
// The first draft sorted by file, on the grounds that a golden test needs a
// fixed order. It does — but `score` is a pure function of `meta`, so sorting
// by it is just as fixed, and the ties are broken by file, line and rule.
//
// The order matters more than it looks. On the first real project this was run
// against, rule 1 produced 78 of 112 findings — every swallowed
// `localStorage.getItem` in a 600 KB translation file — and file order put all
// of them above the four measured deviations that were the point. A report
// whose first screen is its weakest rule teaches the reader to close it.
const ruleOrder = new Map(RULE_IDS.map((id, i) => [id, i]));
findings.sort((a, b) =>
  score(b.meta, b.rule) - score(a.meta, a.rule) ||
  a.file.localeCompare(b.file) ||
  (a.line || 0) - (b.line || 0) ||
  ruleOrder.get(a.rule) - ruleOrder.get(b.rule) ||
  a.anchor.localeCompare(b.anchor));
skipped.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));

// ------------------------------------------------------------------ snapshot
const w = prepare(argv, {
  detector: 'scan',
  root: ROOT,
  args: argv.slice(1),
  cfg,
  counts: {
    files: ir.filesRead,
    htmlBlocks: ir.htmlBlocks,
    functions: ir.functions.length,
    handlers: ir.handlers.length,
    reads: ir.reads.length,
    findings: findings.length,
    passedOver: skipped.length,
    noConvention: skipped.filter(s => s.cause === 'no-convention').length,
    parseErrors: ir.parseErrors.length,
    generated: ir.generated.length,
    unreadable: unreadableFiles().length,
  },
  findings,
});

// ------------------------------------------------------------------ report
console.log(t('scanTitle'));
console.log(t('root') + ROOT);
console.log(t('scanStats', ir.filesRead, ir.functions.length, ir.handlers.length, ir.reads.length));
console.log(t('scanRules', selected.map(r => r.id).join(', '), LAYER, MINPOP));
console.log(t('settings') + cfg.describe());
console.log(t('scanFindings', w.snap.findings.length, w.diff && !w.showAll ? t('onlyNewShown') : ''));
console.log(t('scanPerRule', RULE_IDS.filter(id => perRule.has(id))
  .map(id => id + '=' + perRule.get(id)).join('  ')));
// TWO DIFFERENT SILENCES, COUNTED SEPARATELY.
//
//   too-few-peers  — the group never reached minpop, so no comparison was made
//   no-convention  — the group was big enough and every member does it this way
//
// The first draft ran them together and derived "did anything speak" from the
// wording of the skip reason. It got it backwards: a lone `fetch` skipped for
// "only 1 peer, 9 needed" was counted as a comparison that happened, so a run
// that compared nothing at all printed `findings: 0` and stopped — this tool's
// own defect, in this tool. The resilience suite caught it; the fix is that the
// rules now say WHY they went quiet instead of the reader guessing from prose.
const tooFew = skipped.filter(s => s.cause === 'too-few-peers');
const noConvention = skipped.filter(s => s.cause === 'no-convention');
if (tooFew.length) console.log(t('scanSkipped', tooFew.length));
if (noConvention.length) console.log(t('scanNoConvention', noConvention.length));
diffHeader(w);

// The population check comes AFTER the header, so the numbers that explain it
// are already on screen when the sentence appears.
{
  const none = noPopulation(ir.handlers.length + ir.reads.length + ir.functions.length,
    findings.length + noConvention.length, MINPOP);
  if (none) { console.log(''); console.log(none); }
}
console.log('');

for (const [i, f] of w.toShow.slice(0, TOP).entries()) print(f, i + 1);

if (w.toShow.length > TOP) console.log(t('moreFindings', w.toShow.length - TOP));

if (VERBOSE && skipped.length) {
  console.log('');
  console.log(t('scanSkippedList'));
  for (const s of skipped)
    console.log('   ' + s.file + ':' + s.line + '   [' + s.rule + ']  ' + s.label + '   — ' + s.reason);
}

if (ir.generated.length) {
  console.log('');
  console.log(t('generatedSkipped', ir.generated.length,
    ir.generated.slice(0, 3).map(g => g.file + ' (' + g.why + ')').join(', ') +
    (ir.generated.length > 3 ? ', ...' : '')));
}
if (ir.parseErrors.length) {
  console.log('');
  console.log(t('parseErrors', ir.parseErrors.length,
    ir.parseErrors.slice(0, 5).join(', ') + (ir.parseErrors.length > 5 ? ', ...' : '')));
}
for (const u of files.unreadableDirs || [])
  console.log(t('inputUnreadable', ir.rel(u.dir), u.code));

resultExit(w.newCount ? 1 : 0);
reportUnreadable(ir.rel);
reportNonUtf8(ir.rel);

// ------------------------------------------------------------------ printing
function print(f, n) {
  const d = f.detail || {};
  console.log('## [' + n + '] ' + f.rule + '   ' + f.file + ':' + f.line);
  console.log('');
  console.log('     ' + f.label);
  console.log('');

  console.log(t('secDeviation'));
  if (f.rule === 'swallowed') {
    if (d.alone) console.log(t('r1Alone'));
    else console.log(t('r1Neighbours', f.meta.safe, f.meta.peers, d.layerText));
  } else if (f.rule === 'default-on-error') {
    console.log(t('r2Neighbours', f.meta.safe, f.meta.peers, f.meta.family, d.layerText));
  } else if (f.rule === 'no-timeout') {
    console.log(t('r3Neighbours', f.meta.safe, f.meta.peers, f.meta.family, d.layerText));
  } else if (f.rule === 'same-answer') {
    console.log(t('r4Neighbours', f.meta.safe, f.meta.peers, d.layerText));
    console.log(t('r4Where', d.failureLine, d.emptyLine));
  }
  for (const nb of d.neighbours || [])
    console.log('       ' + nb.file + ':' + nb.line + '   ' + nb.note);
  console.log('');

  console.log(t('secWhy'));
  if (f.rule === 'swallowed') console.log(t('r1Why'));
  else if (f.rule === 'default-on-error') console.log(t('r2Why', d.value));
  else if (f.rule === 'no-timeout') console.log(t('r3Why'));
  else if (f.rule === 'same-answer') console.log(t('r4Why'));
  console.log('');

  console.log(t('secFix'));
  if (f.rule === 'swallowed') console.log(t('r1Fix'));
  else if (f.rule === 'default-on-error') console.log(t('r2Fix'));
  else if (f.rule === 'no-timeout') console.log(t('r3Fix', d.guard));
  else if (f.rule === 'same-answer') console.log(t('r4Fix'));
  console.log(t('muteHint'));
  console.log('');
}

export { ROOT, path };
