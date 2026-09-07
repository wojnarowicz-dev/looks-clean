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

// THE TWO RUNS MUST STAY TWO RUNS. Collapsing them into one figure is the
// tempting edit — it reads better and it is a lie about how the number was
// arrived at.
check('two measurements are kept, not one corrected',
  precision.measurements.length >= 2,
  precision.measurements.length + ' recorded');

const latest = precision.measurements[precision.measurements.length - 1];
const earlier = precision.measurements[0];

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
  const PRIVATE = /VideoAnalyzerProWeb|vap-account|vap-site|opinions-vap|i18n-vap|dream_analyzer/;
  for (const [file] of PAGES)
    check(file + ' names no private repository', !PRIVATE.test(text[file]),
      (text[file].match(PRIVATE) || [''])[0]);
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
