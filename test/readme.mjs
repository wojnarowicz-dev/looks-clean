// looks-clean — layer 9: does the README tell the truth?
//
// THE JOKE THAT IS NOT ONE. This tool reports code whose output does not depend
// on what it claims to have checked. Its README is two pages of claims about
// what its code does. A page of numbers nobody re-derives is the same defect in
// prose: it looks like a report and it is a memory.
//
// So the READMEs are checkable artefacts. Every number is tagged in the
// Markdown and re-derived here from the running tool; every command shown is
// executed; every flag, file, script, link and anchor is resolved. When they
// disagree the README is wrong until somebody says otherwise — the code is the
// fact and the page is the claim, which is the same order of authority this
// tool applies to everybody else.
//
// HOW A CLAIM IS TAGGED. An HTML comment carrying a name and a value:
//
//     <!-- lc:claim name=rules value=4 -->
//
// Invisible when rendered, impossible to update by accident. That is the point:
// a number in prose drifts in silence, a tagged number fails a build.
//
// BOTH LANGUAGES ARE CHECKED, AND AGAINST EACH OTHER. A translated page is
// where numbers go to rot: the English one gets updated with the code and the
// other keeps last quarter's figures, which is worse than having no second page
// at all.
//
// WHAT IS NOT CHECKED, deliberately: the prose. No test can tell whether an
// explanation is honest. What it can tell is whether the numbers, the commands,
// the flags, the file names and the links are real — and every documentation
// lie this project has told so far has been one of those.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RULE_IDS, NEEDS_POPULATION } from '../src/rules/index.mjs';
import { FAMILY_NAMES } from '../src/reads.mjs';
import { KEYS, TABLE } from '../src/lang.mjs';
import { DEFAULT_EXCLUDE } from '../src/config.mjs';
import { LANGUAGES } from '../src/languages.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CLI = path.join(ROOT, 'bin', 'looks-clean.mjs');
const CONFIG = path.join(HERE, 'fixtures', 'golden.config.json');
const PAGES = [['README.md', 'en'], ['README.pl.md', 'pl']];

let failed = 0;
let unreachable = null;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log('  ' + (ok ? 'ok    ' : 'FAIL  ') + name.padEnd(52) + (detail || ''));
};

console.log('looks-clean — does the README tell the truth\n');

for (const [file] of PAGES)
  if (!fs.existsSync(path.join(ROOT, file))) {
    console.log('  FAIL  there is no ' + file);
    process.exit(1);
  }
const text = Object.fromEntries(PAGES.map(([f]) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// ---------------------------------------------------------------- the truths
//
// Each of these is measured, not remembered. Two of them cost a scan, which is
// why this layer is not the first one the runner reaches.
function scanCount(dir) {
  const snap = path.join(ROOT, '.looks-clean', 'readme-check-' +
    path.basename(dir) + '.json');
  const r = spawnSync(process.execPath,
    [CLI, 'scan', dir, '--config', CONFIG, '--lang', 'en', '--json', snap],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1e9 });
  if (!fs.existsSync(snap)) throw new Error('scan of ' + dir + ' wrote nothing (exit ' + r.status + ')');
  const n = JSON.parse(fs.readFileSync(snap, 'utf8')).findings.length;
  try { fs.rmSync(snap, { force: true }); } catch { /* leaves no harm */ }
  return n;
}

// THE SELF-CHECK, MEASURED RATHER THAN DESCRIBED. The page said "the
// self-check is clean now" and named four muted sites. The tool says two
// findings and seven mutes, and has done for some time — the sentence was
// written once, was true once, and nothing was comparing it to anything.
// This is the page committing the subject matter of the tool it documents.
//
// Deliberately NOT --config CONFIG: self-check runs against the repository's
// own .looks-clean.json, and a different exclusion list is a different run.
function selfScan() {
  const snap = path.join(ROOT, '.looks-clean', 'readme-check-self.json');
  const r = spawnSync(process.execPath,
    [CLI, 'scan', 'src', '--lang', 'en', '--json', snap],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1e9 });
  if (!fs.existsSync(snap)) throw new Error('self-scan wrote nothing (exit ' + r.status + ')');
  const run = JSON.parse(fs.readFileSync(snap, 'utf8'));
  try { fs.rmSync(snap, { force: true }); } catch { /* leaves no harm */ }
  // THE MUTE COUNT COMES FROM THE OUTPUT, NOT THE SNAPSHOT, because the
  // snapshot does not carry it: `mutedCount` there counts mutes from the
  // config file, and comment mutes are applied afterwards, when the line is
  // known. So the tool prints a number it does not record. Read from stdout
  // here, which is the number the page quotes, and noted in the tracker.
  const m = String(r.stdout || '').match(/muted by comment: (\d+)/);
  return { findings: run.findings.length, muted: m ? Number(m[1]) : 0 };
}
const self = selfScan();

// The layer list and the known-answer table are read from the files that own
// them, so adding a layer or an answer without touching the README fails here.
const layersSource = fs.readFileSync(path.join(HERE, 'all.mjs'), 'utf8');
const layerCount = (layersSource.match(/^\s{2}\['[a-z-]+', '/gm) || []).length;

const answersSource = fs.readFileSync(path.join(HERE, 'known-answers.mjs'), 'utf8');
const answerCount = (answersSource.match(/^\s{4}id: \d+,$/gm) || []).length;
const outOfScope = (answersSource.match(/^\s{4}state: 'SKIP',$/gm) || []).length;

const plantedSource = fs.readFileSync(path.join(HERE, 'golden.mjs'), 'utf8');
const plantedCount = (plantedSource.match(/\{ rule: '[a-z-]+', file:/g) || []).length;

// THE PRECISION MEASUREMENT IS DATA, NOT A RUN.
//
// The verdicts in test/precision.json were reached by reading code; nothing here
// can re-derive them, and a gate that pretended to would be worse than none. So
// two things are checked instead, and both are the kind of thing that rots:
// that the page quotes the file, and that the file adds up. A record whose
// totals do not match its own rows is a measurement nobody can trust, however
// carefully the individual judgements were made.
const precision = JSON.parse(fs.readFileSync(path.join(HERE, 'precision.json'), 'utf8'));

// EVERY MEASUREMENT IS CHECKED, NOT JUST THE LATEST. An old number left on the
// page is the easiest thing in this repository to let rot: nobody re-reads it,
// and it is exactly the number a sceptical reader will check first. Both runs
// are held to the same arithmetic.
for (const m of precision.measurements) {
  const tag = m.id.slice(-24);
  const rows = m.findings;
  const real = rows.filter(r => r.verdict === 'real').length;
  const noise = rows.filter(r => r.verdict === 'noise').length;
  check(tag + ': a row per checked finding',
    rows.length === m.checked, rows.length + ' rows, ' + m.checked + ' declared');
  check(tag + ': verdicts add up', real === m.real && noise === m.noise &&
    real + noise === m.checked, real + ' real + ' + noise + ' noise = ' + (real + noise));

  // Every false alarm names a cause, and the cause tally matches the rows. A
  // cause is the useful half of a precision number: the count says how often,
  // the cause says what to do about it.
  const uncaused = rows.filter(r => r.verdict === 'noise' && !r.cause);
  check(tag + ': every false alarm names a cause', uncaused.length === 0,
    uncaused.length ? uncaused[0].site : noise + ' causes given');
  const tally = {};
  for (const r of rows) if (r.cause) tally[r.cause] = (tally[r.cause] || 0) + 1;
  const wrongTally = Object.keys(m.causes).filter(k => m.causes[k].count !== (tally[k] || 0));
  const undeclared = Object.keys(tally).filter(k => !(k in m.causes));
  check(tag + ': the cause tally matches the rows',
    wrongTally.length === 0 && undeclared.length === 0,
    wrongTally.length ? wrongTally.map(k => k + ': ' + m.causes[k].count + ' vs ' + tally[k]).join(', ')
      : undeclared.length ? 'undeclared: ' + undeclared.join(', ')
        : Object.keys(tally).length + ' causes');

  // The per-project rows must add up, and no project may claim to have checked
  // more findings than it reported. A project that reported nothing must say
  // WHY, because a zero with no reason attached is the shape of defect this
  // whole tool is about.
  const sum = (k) => m.projects.reduce((a, p) => a + p[k], 0);
  check(tag + ': the per-project rows add up',
    sum('checked') === m.checked && sum('real') === m.real && sum('noise') === m.noise &&
    m.projects.reduce((a, p) => a + p.counts.findings, 0) === m.reportedInTotal,
    sum('checked') + ' checked, ' + m.reportedInTotal + ' reported');
  const overClaimed = m.projects.filter(p => p.checked > p.counts.findings);
  check(tag + ': nothing claims more checked than reported', overClaimed.length === 0,
    overClaimed.length ? overClaimed[0].name : m.projects.length + ' projects');
  const unexplainedZero = m.projects.filter(p => p.counts.findings === 0 && !p.zeroBecause);
  check(tag + ': every zero says why it is a zero', unexplainedZero.length === 0,
    unexplainedZero.length ? unexplainedZero[0].name
      : m.projects.filter(p => p.counts.findings === 0).length + ' zero(s)');
}

// A BEFORE/AFTER THAT CLAIMS NOTHING CHANGED HAS TO ADD UP TOO, and it is the
// easiest record here to write carelessly: "no change" is what everybody hopes
// for, so nobody checks it. The per-project rows must sum to the declared
// totals, and a run declared identical must actually have the same count on
// both sides — otherwise a change that moved findings could sit in this file
// describing itself as harmless.
for (const c of precision.changeChecks || []) {
  const tag = c.id.slice(-28);
  const before = c.projects.reduce((a, p) => a + p.findingsBefore, 0);
  const after = c.projects.reduce((a, p) => a + p.findingsAfter, 0);
  check(tag + ': the per-project rows add up',
    before === c.findingsBefore && after === c.findingsAfter,
    before + ' before, ' + after + ' after');
  const disagree = c.projects.filter(p => p.identical && p.findingsBefore !== p.findingsAfter);
  check(tag + ': nothing calls itself identical and differs', disagree.length === 0,
    disagree.length ? disagree[0].name : c.projects.length + ' projects');
  check(tag + ': the verdict matches the rows',
    c.identical === c.projects.every(p => p.identical),
    c.identical ? 'identical' : 'changed');
  // A record may carry its own explanatory count, and where it does the count
  // has to agree with the verdict. Asked of every record, this would fail on a
  // field the next one has no reason to carry, and the failure would look real.
  if (c.projects.some(p => 'ofThoseTheDirectoryHadOne' in p)) {
    const climbed = c.projects.reduce((a, p) => a + (p.ofThoseTheDirectoryHadOne || 0), 0);
    check(tag + ': nothing moved because no rung above had an answer',
      !c.identical || climbed === 0, climbed + ' climb(s) available');
  }
  // Where a record counts what moved BELOW the findings, an identical verdict is
  // not contradicted by a non-zero count — a changed attribution that reported
  // nothing either way is exactly what happened here — but the count must be
  // declared rather than left to be assumed zero.
  // A per-corpus count of what a correction removed has to subtract correctly.
  // It is the one line of this record somebody would edit to make a correction
  // look larger than it was.
  for (const row of c.rule4ByCorpus || []) {
    check(tag + ': ' + row.corpus.slice(0, 30) + ' subtracts',
      row.before - row.after === row.removed && row.after <= row.before,
      row.before + ' - ' + row.removed + ' = ' + row.after);
  }
  if (c.projects.some(p => 'attributionsMoved' in p)) {
    const undeclared = c.projects.filter(p => !('attributionsMoved' in p && 'handlersOverARead' in p));
    const impossible = c.projects.filter(p => p.attributionsMoved > p.handlersOverARead);
    check(tag + ': every project counts what moved underneath',
      undeclared.length === 0 && impossible.length === 0,
      undeclared.length ? 'undeclared: ' + undeclared[0].name
        : impossible.length ? 'more moved than exist: ' + impossible[0].name
          : c.projects.reduce((a, p) => a + p.attributionsMoved, 0) + ' of ' +
            c.projects.reduce((a, p) => a + p.handlersOverARead, 0));
  }
}

// A LANGUAGE SAMPLE HAS THREE VERDICTS, so it has more ways to add up wrongly
// than a two-verdict measurement. The tempting error here is not arithmetic: it
// is moving a finding from `noise` to `deliberate` after the fact, which lowers
// the number the threshold is checked against without anybody editing a total.
// So the per-rule tallies and the cause tally are both held to the rows.
for (const smp of precision.languageSamples || []) {
  // A SAMPLE IS NOT ALWAYS TWO HALVES. Java drew twenty at random and twenty
  // from the top, because the top of a ranked list is not the middle of it.
  // Dart reported twenty-two, which is few enough to read all of, so there is
  // one part and it is the whole. Hard-coding the two halves would have made
  // the honest record the one the gate could not check.
  // A FOURTH SHAPE, AND THE COMMENT ABOVE PREDICTED IT. A release that adds
  // findings to a population already measured reads the NEW ones, and calling
  // that `sample` would have been a lie about what was checked. Hard-coding
  // three names had made the honest record the one this gate could not see —
  // the same mistake, one shape later.
  const parts = [['random', smp.randomSample], ['first', smp.firstSample],
    ['all', smp.sample], ['new', smp.newFindings]]
    .filter(([, part]) => part);
  check(smp.language + ': the record carries at least one sample', parts.length > 0,
    parts.map(p => p[0]).join(', ') || 'none');
  for (const [which, part] of parts) {
    const tag = smp.language + '/' + which;
    const rows = part.findings;
    const n = v => rows.filter(r => r.verdict === v).length;
    check(tag + ': a row per checked finding',
      rows.length === part.checked, rows.length + ' rows, ' + part.checked + ' declared');
    check(tag + ': the three verdicts add up',
      n('real') === part.real && n('deliberate') === part.deliberate && n('noise') === part.noise &&
      part.real + part.deliberate + part.noise === part.checked,
      part.real + ' real + ' + part.deliberate + ' deliberate + ' + part.noise + ' noise');

    // Only noise names a cause, and only noise may. A cause on a finding that
    // was judged real is the record disagreeing with itself.
    const uncaused = rows.filter(r => r.verdict === 'noise' && !r.cause);
    const overCaused = rows.filter(r => r.verdict !== 'noise' && r.cause);
    check(tag + ': every false alarm names a cause, and only those',
      uncaused.length === 0 && overCaused.length === 0,
      uncaused.length ? 'uncaused: ' + uncaused[0].ref
        : overCaused.length ? 'caused but not noise: ' + overCaused[0].ref
          : Object.keys(part.causes).length + ' causes');
    const tally = {};
    for (const r of rows) if (r.cause) tally[r.cause] = (tally[r.cause] || 0) + 1;
    const wrong = Object.keys(part.causes).filter(k => part.causes[k] !== (tally[k] || 0));
    const undeclared = Object.keys(tally).filter(k => !(k in part.causes));
    check(tag + ': the cause tally matches the rows',
      wrong.length === 0 && undeclared.length === 0,
      wrong.length ? wrong.join(', ') : undeclared.length ? 'undeclared: ' + undeclared.join(', ')
        : part.noise + ' noise accounted for');

    const byRule = {};
    for (const r of rows) {
      byRule[r.rule] = byRule[r.rule] || { checked: 0, real: 0, deliberate: 0, noise: 0 };
      byRule[r.rule].checked++; byRule[r.rule][r.verdict]++;
    }
    const ruleMismatch = Object.keys({ ...byRule, ...part.perRule }).filter(k =>
      !part.perRule[k] || !byRule[k] ||
      ['checked', 'real', 'deliberate', 'noise'].some(f => part.perRule[k][f] !== byRule[k][f]));
    check(tag + ': the per-rule tally matches the rows', ruleMismatch.length === 0,
      ruleMismatch.length ? ruleMismatch.join(', ') : Object.keys(byRule).length + ' rules');

    check(tag + ': nothing claims more checked than reported',
      part.checked <= smp.reported, part.checked + ' of ' + smp.reported);
  }

  // The record says every false alarm came from ONE rule, and that sentence is
  // the whole reason the correction is aimed at a rule instead of a dictionary.
  // If a second rule ever starts producing noise, the conclusion has to be
  // rewritten rather than reread.
  // Java's record says every false alarm came from ONE rule, and that sentence
  // is why its correction was aimed at a rule rather than a dictionary. Dart's
  // says the opposite in as many words, so the check is not that there is one
  // noisy rule but that the record and the rows agree about which rules those
  // are — a claim about concentration that the rows have stopped supporting is
  // the edit nobody would notice.
  const noisyRules = [...new Set(parts.flatMap(([, p]) => p.findings)
    .filter(r => r.verdict === 'noise').map(r => r.rule))].sort();
  const blamed = [...new Set(Object.entries(
    parts.reduce((acc, [, p]) => {
      for (const [rule, t] of Object.entries(p.perRule)) acc[rule] = (acc[rule] || 0) + t.noise;
      return acc;
    }, {})).filter(([, n]) => n > 0).map(([rule]) => rule))].sort();
  check(smp.language + ': the per-rule tallies name the same noisy rules as the rows',
    JSON.stringify(noisyRules) === JSON.stringify(blamed),
    noisyRules.join(', ') || 'none');
}

// A PAGE THAT NAMES THE LANGUAGES HAS TO NAME THIS SET, and must not deny one
// of them in the same breath. Both pages offered "JavaScript, TypeScript or
// Java" for a release after Dart shipped, and both listed Dart under what the
// tool does NOT read — on the page whose whole subject is a tool that finds
// sentences disagreeing with the code beneath them.
for (const [file] of PAGES) {
  const page = text[file];
  const missing = LANGUAGES.map(l => l.name).filter(nm => !page.includes(nm));
  check(file + ' names every language that is read', missing.length === 0,
    missing.length ? 'missing: ' + missing.join(', ') : LANGUAGES.length + ' languages');

  // The line that lists what is NOT read is the one that goes stale silently,
  // because adding a language is a happy edit and nobody rereads the denials.
  // ONLY THE DENIAL ITSELF. The same line carries the positive half —
  // "JavaScript and TypeScript first" — so a line-wide match reads its answer
  // out of the wrong clause and fails a page that is correct.
  const denials = [...page.matchAll(/\*\*(?:It does not read|Nie czyta)([^*]*)\*\*/g)].map(m => m[1]);
  const denied = LANGUAGES.map(l => l.name)
    .filter(nm => denials.some(d => new RegExp('\\b' + nm, 'i').test(d)));
  check(file + ' does not deny a language it reads', denied.length === 0,
    denied.length ? 'denied: ' + denied.join(', ') : denials.length + ' denial line(s) checked');
}

// AND THE SAME FOR THE FAMILIES, for the same reason. The count is already a
// claim, and the claim caught the count — but the sentence beside it spells
// the families out by name, and a number agreeing with the tool while the
// list beside it is short by one is exactly the shape this tool reports.
// Adding `assets` in 0.3.1 left both pages naming eight of nine.
//
// SPELLINGS, NOT SLUGS. A page is prose: it writes "a dynamic import", not
// `dynamic-import`. Each variant is listed here with the family it stands
// for, so a page cannot satisfy this by accident and a family cannot be
// quietly dropped by rewording the sentence around it.
const FAMILY_SPELLINGS = {
  'dynamic-import': ['dynamic-import', 'dynamic import', 'dynamiczny import'],
};
for (const [file] of PAGES) {
  const page = text[file];
  const missing = FAMILY_NAMES.filter(nm =>
    !(FAMILY_SPELLINGS[nm] || [nm]).some(v => page.includes(v)));
  check(file + ' names every family a read can have', missing.length === 0,
    missing.length ? 'missing: ' + missing.join(', ') : FAMILY_NAMES.length + ' families');
}

// THE TWO RUNS MUST STAY TWO RUNS. Collapsing them into one figure is the
// tempting edit — it reads better and it is a lie about how the number was
// arrived at.
check('two measurements are kept, not one corrected',
  precision.measurements.length >= 2,
  precision.measurements.length + ' recorded');

const latest = precision.measurements[precision.measurements.length - 1];
const earlier = precision.measurements[0];

// THE JAVA SAMPLE HAS TWO NUMBERS AND THE PAGE MUST CARRY BOTH. The one a
// reader meets first is the top of the list, and on this material that is the
// worse of the two — so a page quoting only the random figure would be making
// exactly the promise this tool exists to catch: a number that reads clean
// because of what it left out.
const javaSample = (precision.languageSamples || []).find(s => s.language === 'java');
// PINNED BY ID, NOT BY LANGUAGE. From 0.4.0 there are two Dart samples — the
// closed application measured before 0.3.0, and the two public projects
// measured before 0.4.0. A find() on the language alone would have silently
// answered with whichever was written first, and every Dart claim on the page
// would have followed it.
const dartSample = (precision.languageSamples || [])
  .find(s => s.id === '2026-09-21-dart-flutter-app');
const freshDartSample = (precision.languageSamples || [])
  .find(s => s.id === '2026-09-21-dart-two-public-projects');
const freshDartChange = (precision.changeChecks || [])
  .find(c => c.id === '2026-09-21-dart-sees-past-one-application');
check('a dart sample is recorded', !!dartSample, dartSample ? dartSample.id : 'none');
check('the 0.4.0 dart sample is recorded', !!freshDartSample,
  freshDartSample ? freshDartSample.id : 'none');
check('the 0.4.0 change check is recorded', !!freshDartChange,
  freshDartChange ? freshDartChange.id : 'none');
check('a java sample is recorded', !!javaSample, javaSample ? javaSample.id : 'none');
const noisyRules = javaSample
  ? new Set([...javaSample.randomSample.findings, ...javaSample.firstSample.findings]
    .filter(r => r.verdict === 'noise').map(r => r.rule)).size
  : null;

const TRUTH = {
  precisionMeasurements: precision.measurements.length,
  precisionProjects: latest.projects.length,
  precisionReported: latest.reportedInTotal,
  precisionChecked: latest.checked,
  precisionReal: latest.real,
  precisionNoise: latest.noise,
  precisionCheckedBefore: earlier.checked,
  precisionRealBefore: earlier.real,
  precisionNoiseBefore: earlier.noise,
  precisionReportedBefore: earlier.reportedInTotal,
  precisionTestCode: earlier.excludingTestsWouldRemove.ofTheThirtyChecked,
  rules: RULE_IDS.length,
  rulesNeedingPopulation: Object.values(NEEDS_POPULATION).filter(Boolean).length,
  layers: layerCount,
  knownAnswers: answerCount,
  knownAnswersInScope: answerCount - outOfScope,
  families: FAMILY_NAMES.length,
  languages: new Set(Object.values(TABLE).flatMap(e => Object.keys(e))).size,
  messages: KEYS.length,
  fixtureFindings: scanCount(path.join(HERE, 'fixtures', 'project')),
  fixturePlanted: plantedCount,
  cleanFindings: scanCount(path.join(HERE, 'fixtures', 'clean')),
  defaultExclusions: DEFAULT_EXCLUDE.length,
  selfCheckFindings: self.findings,
  selfCheckMuted: self.muted,
  javaSampleReported: javaSample && javaSample.reported,
  javaRandomChecked: javaSample && javaSample.randomSample.checked,
  javaRandomReal: javaSample && javaSample.randomSample.real,
  javaRandomDeliberate: javaSample && javaSample.randomSample.deliberate,
  javaRandomNoise: javaSample && javaSample.randomSample.noise,
  javaFirstChecked: javaSample && javaSample.firstSample.checked,
  javaFirstReal: javaSample && javaSample.firstSample.real,
  javaFirstDeliberate: javaSample && javaSample.firstSample.deliberate,
  javaFirstNoise: javaSample && javaSample.firstSample.noise,
  javaNoisyRules: noisyRules,
  dartReported: dartSample && dartSample.reported,
  dartChecked: dartSample && dartSample.sample.checked,
  dartReal: dartSample && dartSample.sample.real,
  dartDeliberate: dartSample && dartSample.sample.deliberate,
  dartNoise: dartSample && dartSample.sample.noise,
  // The 0.4.0 measurement, kept beside the 0.3.0 one rather than replacing it.
  dartFreshReads: freshDartChange && freshDartChange.dartTotals.readsAfter,
  dartFreshReported: freshDartSample && freshDartSample.reported,
  dartFreshChecked: freshDartSample && freshDartSample.newFindings.checked,
  dartFreshReal: freshDartSample && freshDartSample.newFindings.real,
  dartFreshDeliberate: freshDartSample && freshDartSample.newFindings.deliberate,
  dartFreshNoise: freshDartSample && freshDartSample.newFindings.noise,
};

// ---------------------------------------------------------------- 1. claims
const claimsOf = src => [...src.matchAll(/<!--\s*lc:claim\s+name=([\w.]+)\s+value=([^\s]+)\s*-->/g)]
  .map(m => ({ name: m[1], value: m[2] }));

for (const [file] of PAGES) {
  const claims = claimsOf(text[file]);
  check(file + ' carries tagged claims', claims.length > 0, claims.length + ' found');
  for (const c of claims) {
    if (!(c.name in TRUTH)) {
      check(file + ' claim ' + c.name, false,
        'no such measurement — the page names something the tool does not report');
      continue;
    }
    check(file + ' claim ' + c.name, String(TRUTH[c.name]) === c.value,
      'the page says ' + c.value + ', the tool says ' + TRUTH[c.name]);
  }
  // A measurement nobody claims is a gate protecting nothing.
  const unclaimed = Object.keys(TRUTH).filter(k => !claims.some(c => c.name === k));
  check(file + ' claims every measurement', unclaimed.length === 0,
    unclaimed.length ? 'unclaimed: ' + unclaimed.join(', ') : Object.keys(TRUTH).length + ' measurements');
}

// The two pages must agree with each other as well as with the tool. Checking
// each against the truth already implies this — but saying it out loud means
// the failure names translation drift rather than a wrong number.
{
  const [a, b] = PAGES.map(([f]) => Object.fromEntries(claimsOf(text[f]).map(c => [c.name, c.value])));
  const drifted = Object.keys(a).filter(k => a[k] !== b[k]);
  check('the two pages claim the same numbers', drifted.length === 0,
    drifted.length ? drifted.map(k => k + ': ' + a[k] + ' vs ' + b[k]).join(', ') : '');
}

// ---------------------------------------------------------------- 2. commands
//
// EVERY COMMAND SHOWN MUST RUN. odd-one-out once shipped a help screen telling
// people to type a command that did not exist until `npm i -g`, and a README is
// the likeliest place for the same mistake: a flag renamed in the code and left
// standing in the examples.
for (const [file] of PAGES) {
  const commands = [...text[file].matchAll(/^ {4}\$ looks-clean (.+)$/gm)].map(m => m[1].trim());
  check(file + ' shows runnable commands', commands.length > 0, commands.length + ' found');
  for (const line of commands) {
    const args = line.split(/\s+/)
      .map(a => a.replace('<dir>', path.join(HERE, 'fixtures', 'project'))
        .replace('.looks-clean/run.json', path.join(ROOT, '.looks-clean', 'readme-cmd.json')));
    const r = spawnSync(process.execPath, [CLI, ...args, '--config', CONFIG, '--top', '1'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 1e9, timeout: 120000 });
    // 0 and 1 are results; 2 is a usage error, which is exactly what a stale
    // example produces. Anything else is a crash.
    const ok = r.status === 0 || r.status === 1;
    check('runs: looks-clean ' + line.slice(0, 34), ok,
      ok ? 'exit ' + r.status : 'exit ' + r.status + '  ' +
        String(r.stderr || r.stdout).trim().split(/[\r\n]+/).slice(-1)[0].slice(0, 60));
  }
}
try { fs.rmSync(path.join(ROOT, '.looks-clean', 'readme-cmd.json'), { force: true }); } catch { /* fine */ }

// ---------------------------------------------------------------- 3. names
const KNOWN_FLAGS = new Set(['rule', 'layer', 'minpop', 'top', 'verbose', 'all', 'json',
  'config', 'include-generated', 'lang', 'help', 'version', 'update']);

for (const [file] of PAGES) {
  const flags = [...new Set([...text[file].matchAll(/`--([a-z-]+)/g)].map(m => m[1]))];
  const bad = flags.filter(f => !KNOWN_FLAGS.has(f));
  check(file + ' names only real flags', bad.length === 0,
    bad.length ? 'unknown: --' + bad.join(', --') : flags.length + ' flags');

  const files = [...new Set([...text[file].matchAll(/`((?:src|bin|test)\/[\w./-]+)`/g)].map(m => m[1]))];
  const missing = files.filter(f => !fs.existsSync(path.join(ROOT, f)));
  check(file + ' names only real files', missing.length === 0,
    missing.length ? 'missing: ' + missing.join(', ') : files.length + ' files');

  const scripts = [...new Set([...text[file].matchAll(/`npm run ([a-z-]+)`/g)].map(m => m[1]))];
  const noScript = scripts.filter(s => !(s in pkg.scripts));
  check(file + ' names only real npm scripts', noScript.length === 0,
    noScript.length ? 'missing: ' + noScript.join(', ') : scripts.length + ' scripts');

  const rules = [...new Set([...text[file].matchAll(/`(swallowed|default-on-error|no-timeout|same-answer)`/g)].map(m => m[1]))];
  check(file + ' names only real rules', rules.every(r => RULE_IDS.includes(r)),
    rules.length + ' of ' + RULE_IDS.length + ' named');
}

// ---------------------------------------------------------------- 4. links
for (const [file] of PAGES) {
  const links = [...text[file].matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map(m => m[1]);
  const broken = [];
  for (const href of links) {
    if (/^https?:/.test(href)) continue;                 // not this layer's business
    if (href.startsWith('#')) {
      // An anchor must name a heading on the same page, slugged the way GitHub
      // slugs it. A dead anchor is the commonest rot in a long README and the
      // one nobody notices, because the page still scrolls.
      const slugs = [...text[file].matchAll(/^#{2,6} (.+)$/gm)].map(m =>
        m[1].toLowerCase().replace(/[^\p{L}\p{N} -]/gu, '').trim().replace(/\s+/g, '-'));
      if (!slugs.includes(href.slice(1))) broken.push(href);
      continue;
    }
    if (!fs.existsSync(path.join(ROOT, href.split('#')[0]))) broken.push(href);
  }
  check(file + ' has no broken links', broken.length === 0,
    broken.length ? broken.join(', ') : links.length + ' links');
}

// The two pages must point at each other. A translation nobody can reach from
// the page they landed on is a translation nobody reads.
check('the two pages link to each other',
  text['README.md'].includes('(README.pl.md)') && text['README.pl.md'].includes('(README.md)'), '');

// ---------------------------------------------------------------- 5. the output example
//
// THE SAMPLE REPORT IS RE-RUN AND COMPARED LINE FOR LINE.
//
// The first version of both pages quoted a run against a private repository.
// It was a better story — a real defect in shipped code — and it was
// unverifiable: nobody reading the page could reproduce it, and nothing in this
// repository could tell whether the tool still printed anything like it. A
// sample output that cannot be checked is the same defect this tool reports,
// written in a fenced code block.
//
// So the example is a run over `test/fixtures/project`, the block is tagged
// with the language it was produced in, and it is regenerated here and diffed.
// If a message changes, this fails and names the first line that moved.
for (const [file, lang] of PAGES) {
  const m = text[file].match(/<!--\s*lc:example\s+lang=(\w+)\s*-->\n```\n([\s\S]*?)\n```/);
  if (!m) { check(file + ' carries a tagged output example', false, 'no lc:example block'); continue; }
  check(file + ' tags the example with its language', m[1] === lang, 'lang=' + m[1]);

  const r = spawnSync(process.execPath,
    [CLI, 'scan', path.join(HERE, 'fixtures', 'project'), '--config', CONFIG,
      '--rule', 'default-on-error', '--top', '1', '--lang', lang],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1e9 });
  const lines = (r.stdout || '').split('\n');
  const start = lines.findIndex(l => l.startsWith('## [1]'));
  const end = lines.findIndex((l, i) => i > start && l.startsWith('...'));
  const fresh = start < 0 || end < 0 ? null : lines.slice(start, end - 1).join('\n').replace(/\s+$/, '');

  if (fresh === null) {
    check(file + ' example is reproducible', false, 'the scan printed no first finding');
    continue;
  }
  const shown = m[2].replace(/\s+$/, '').split('\n');
  const got = fresh.split('\n');
  let firstDiff = -1;
  for (let i = 0; i < Math.max(shown.length, got.length); i++)
    if (shown[i] !== got[i]) { firstDiff = i; break; }
  check(file + ' example matches a fresh run', firstDiff === -1,
    firstDiff === -1 ? got.length + ' lines identical'
      : 'line ' + (firstDiff + 1) + ': page ' + JSON.stringify((shown[firstDiff] || '').slice(0, 40)) +
        ' vs tool ' + JSON.stringify((got[firstDiff] || '').slice(0, 40)));

  // And the headings in it must be the dictionary's current ones, so a renamed
  // heading is named as such rather than showing up as an anonymous line diff.
  const wanted = ['secDeviation', 'secWhy', 'secFix'].map(k => TABLE[k][lang]);
  const absent = wanted.filter(w => !m[2].includes(w));
  check(file + ' example shows the headings the tool prints', absent.length === 0,
    absent.length ? 'not in the block: ' + absent.join(', ') : wanted.length + ' headings');
}

// ---------------------------------------------------------------- 5b. no private names
//
// The examples must be reproducible by a stranger, which also means they must
// not name repositories a stranger cannot open. Private project names stay in
// `test/known-answers.mjs`, where naming the material IS the point, and nowhere
// else.
{
  const PRIVATE = /VideoAnalyzerProWeb|vap-account|vap-site|opinions-vap|i18n-vap|dream[_-]analyzer/i;
  for (const [file] of PAGES)
    check(file + ' names no private repository', !PRIVATE.test(text[file]),
      (text[file].match(PRIVATE) || [''])[0]);

  // THE RECORD IS READ BY THE SAME STRANGER. This guard watched the two pages
  // and not test/precision.json, and the first thing to slip past it was a
  // sample id naming the product it was measured on — written by the person
  // who had just finished withholding every location inside it.
  //
  // known-answers.mjs is exempt for the reason it always was: naming the
  // material is what that file is for, and the answers cannot be read without
  // a repository to read them from.
  {
    const record = fs.readFileSync(path.join(HERE, 'precision.json'), 'utf8');
    const hit = record.match(PRIVATE);
    check('the precision record names no private repository', !hit, hit ? hit[0] : 'none');
  }
}

// ---------------------------------------------------------------- 6. the licence
//
// AND THE RECORD SAYS WHICH TOOL PRODUCED IT. precision.json carries a
// toolVersion, and it read 0.1.0 through the whole of 0.2.0, 0.2.1 and 0.3.0
// — three releases of measurements filed under the version that did not make
// them. Nothing was comparing the two, so nothing said so.
//
// The per-measurement toolVersion fields are NOT checked against this: an old
// measurement is supposed to name the old tool, and forcing those to match
// would destroy the one thing the record is for. Only the top-level field,
// which says what this file describes NOW, has to be the version in hand.
check('the record names the version that produced it',
  precision.toolVersion === pkg.version,
  'record ' + precision.toolVersion + ', package ' + pkg.version);

// THREE PLACES SAY WHAT THE LICENCE IS — the LICENSE file, package.json, and a
// line at the bottom of each page — and there is nothing to stop them drifting
// apart. Two of them agreeing while the third says something else is the worst
// case, because whichever one the reader happens to open, they get an answer
// that looks authoritative.
{
  const licence = fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8');
  const AUTHOR = 'Aleksander Wojnarowicz';
  check('LICENSE is MIT and names the author',
    /^MIT License/m.test(licence) && licence.includes(AUTHOR),
    licence.split('\n')[0]);
  check('package.json says the same licence and author',
    pkg.license === 'MIT' && pkg.author === AUTHOR,
    pkg.license + ' / ' + pkg.author);
  for (const [file] of PAGES)
    check(file + ' says the same licence and author',
      /\bMIT\b/.test(text[file]) && text[file].includes(AUTHOR), '');
}

// ---------------------------------------------------------------- 7. the package
//
// WHAT A STRANGER ACTUALLY RECEIVES. Everything above checks the page; this
// checks the parcel. `npm pack` is run for real rather than the allow-list in
// package.json being read back, because the allow-list is a claim about the
// tarball and the tarball is the fact — the same order of authority applied to
// packaging.
//
// test/ is excluded deliberately: the suite reaches for two private
// repositories by path, and shipping it would hand every installer a set of
// tests that skip on their machine. A tool whose subject is telling "skipped"
// from "passed" should not make that its first impression.
{
  // NPM IS RUN THROUGH ITS OWN JAVASCRIPT ENTRY POINT, and the two obvious
  // spellings both failed on the machine this was written on:
  //   `npm`      -> ENOENT: spawn does not apply PATHEXT to an extensionless name
  //   `npm.cmd`  -> EINVAL: Node refuses to spawn a .cmd without a shell
  // and `shell: true` earns a deprecation warning on every run — a warning
  // nobody can silence is a line people learn to scroll past, including the
  // next one. `npm-cli.js` under node is none of those things.
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean).filter(p => /npm-cli\.js$/.test(p) && fs.existsSync(p));

  let files = null;
  let why = 'npm-cli.js was not found next to ' + process.execPath;
  if (candidates.length) {
    const r = spawnSync(process.execPath, [candidates[0], 'pack', '--dry-run', '--json'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 1e9 });
    try { files = JSON.parse(r.stdout)[0].files.map(f => f.path.replace(/\\/g, '/')); }
    catch (e) { why = 'could not read `npm pack --dry-run --json` (exit ' + r.status + ')'; }
  }

  if (!files) {
    // NOT A PASS AND NOT A FAILURE. Nothing is wrong with the package; this
    // machine could not be asked what the package contains. The layer exits 2,
    // which is the runner's code for exactly that, and the difference between
    // it and a green tick is the whole subject of this project.
    unreachable = why;
    console.log('  ????  ' + 'the package could not be inspected'.padEnd(52) + why);
  } else {
    const FORBIDDEN = [/^test\//, /^\.github\//, /(^|\/)\.env/, /^node_modules\//,
      /^\.looks-clean\//, /\.local$/];
    const leaked = files.filter(f => FORBIDDEN.some(re => re.test(f)));
    check('the package ships nothing it should not', leaked.length === 0,
      leaked.length ? leaked.join(', ') : files.length + ' files');

    // And the control: a package that ships nothing at all also ships nothing
    // forbidden. What must be there has to be there.
    const REQUIRED = ['package.json', 'LICENSE', 'README.md', 'README.pl.md',
      'bin/looks-clean.mjs', 'src/scan.mjs'];
    const absent = REQUIRED.filter(f => !files.includes(f));
    check('the package ships what it must', absent.length === 0,
      absent.length ? 'missing: ' + absent.join(', ') : REQUIRED.length + ' required files');
  }
}

// ---------------------------------------------------------------- 8. the badges
//
// A BADGE IS A CLAIM, AND THE SECOND ONE IS THE CLAIM THAT MATTERS.
//
// GitHub Actions has no amber. `npm test` exits 2 when a layer could not reach
// its material, and CI maps that onto a green job so the badge stays useful —
// which leaves a green badge standing over four known answers nobody checked.
// The static yellow badge beside it is what stops that being a lie, so it is
// held to the same standard as every other number on the page: it is re-derived
// by running the contract with no external material, exactly as CI does.
{
  const WORKFLOW = '.github/workflows/ci.yml';
  check('the CI workflow exists', fs.existsSync(path.join(ROOT, WORKFLOW)), WORKFLOW);

  // What the known-answer contract reports when it cannot reach the private
  // repositories — which is the state every CI run is in.
  const r = spawnSync(process.execPath, [path.join(HERE, 'known-answers.mjs')], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 1e9,
    env: {
      ...process.env,
      LC_ODD: path.join(ROOT, 'no-such-checkout'),
      LC_WEB: path.join(ROOT, 'no-such-checkout'),
      LC_JAVA: path.join(ROOT, 'no-such-checkout'),
    },
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = out.match(/(\d+) found \([^)]*\), (\d+) lost, (\d+) unreachable\s+\((\d+) answers\)/);
  check('the contract reports its CI state', !!m && r.status === 2,
    m ? m[3] + ' unreachable of ' + m[4] + ', exit ' + r.status : 'could not parse the summary');

  if (m) {
    const unreachable = m[3], total = m[4];
    for (const [file] of PAGES) {
      const badges = [...text[file].matchAll(/\[!\[[^\]]*\]\(([^)]+)\)\]\(([^)]+)\)/g)];
      check(file + ' carries two badges at the top', badges.length >= 2, badges.length + ' found');

      // The workflow badge must point at a workflow that is really there.
      const wf = badges.find(b => /actions\/workflows\//.test(b[1]));
      check(file + ' badge names a real workflow',
        !!wf && wf[1].includes(path.basename(WORKFLOW)) && wf[1].includes('badge.svg'),
        wf ? wf[1].split('/actions/')[1] : 'no workflow badge');

      // The honest half: the numbers baked into the shields.io URL must be the
      // numbers the contract reports. Nothing else on this page is allowed to
      // be a remembered figure, and a badge is the most-read figure of all.
      const yellow = badges.find(b => /img\.shields\.io/.test(b[1]));
      if (!yellow) {
        check(file + ' carries the known-answer badge', false, 'no shields.io badge');
      } else {
        const url = decodeURIComponent(yellow[1]);
        const ok = new RegExp('\\b' + unreachable + '\\b').test(url) &&
          new RegExp('\\b' + total + '\\b').test(url) && /yellow/.test(url);
        check(file + ' known-answer badge states the real numbers', ok,
          ok ? unreachable + ' of ' + total + ', yellow'
            : 'badge says ' + JSON.stringify(url.split('/badge/')[1] || url) +
              ', the contract says ' + unreachable + ' of ' + total);
        check(file + ' known-answer badge links to the contract',
          yellow[2].includes('known-answers.mjs'), yellow[2]);
      }
    }
  }
}

console.log('\n  ' + (failed ? failed + ' failed' : 'both pages agree with the tool'));
if (failed) {
  console.log('\n  The code is the fact and the README is the claim. Fix the claim, or fix');
  console.log('  the code and re-record — but a page of numbers that drifts away from what');
  console.log('  it describes is the defect this whole tool is about, written in prose.');
  process.exit(1);
}
if (unreachable) {
  console.log('');
  console.log('  One check could not be run on this machine, so it proves nothing:');
  console.log('  ' + unreachable);
  process.exit(2);
}
