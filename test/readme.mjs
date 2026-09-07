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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CLI = path.join(ROOT, 'bin', 'looks-clean.mjs');
const CONFIG = path.join(HERE, 'fixtures', 'golden.config.json');
const PAGES = [['README.md', 'en'], ['README.pl.md', 'pl']];

let failed = 0;
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

// The layer list and the known-answer table are read from the files that own
// them, so adding a layer or an answer without touching the README fails here.
const layersSource = fs.readFileSync(path.join(HERE, 'all.mjs'), 'utf8');
const layerCount = (layersSource.match(/^\s{2}\['[a-z-]+', '/gm) || []).length;

const answersSource = fs.readFileSync(path.join(HERE, 'known-answers.mjs'), 'utf8');
const answerCount = (answersSource.match(/^\s{4}id: \d+,$/gm) || []).length;
const outOfScope = (answersSource.match(/^\s{4}state: 'SKIP',$/gm) || []).length;

const plantedSource = fs.readFileSync(path.join(HERE, 'golden.mjs'), 'utf8');
const plantedCount = (plantedSource.match(/\{ rule: '[a-z-]+', file:/g) || []).length;

const TRUTH = {
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
// The sample report is quoted from a run against material that is not in this
// repository, so the finding itself cannot be re-derived here. What CAN be
// re-derived is that the shape is the shape the tool still prints: the section
// headings in the example must be the headings the dictionary currently holds,
// in the language of the page it appears on. A renamed heading would otherwise
// leave both pages showing output the tool has not produced for months.
for (const [file, lang] of PAGES) {
  const wanted = ['secDeviation', 'secWhy', 'secFix'].map(k => TABLE[k][lang]);
  const absent = wanted.filter(w => !text[file].includes(w));
  check(file + ' shows the headings the tool prints', absent.length === 0,
    absent.length ? 'not on the page: ' + absent.join(', ') : wanted.length + ' headings');
}

// ---------------------------------------------------------------- 6. the licence
//
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

console.log('\n  ' + (failed ? failed + ' failed' : 'both pages agree with the tool'));
if (failed) {
  console.log('\n  The code is the fact and the README is the claim. Fix the claim, or fix');
  console.log('  the code and re-record — but a page of numbers that drifts away from what');
  console.log('  it describes is the defect this whole tool is about, written in prose.');
  process.exit(1);
}
