// looks-clean — layer 10: the known answers, as a contract.
//
// WHY THIS FILE EXISTS. Six defects were traced by hand, in real code, before a
// line of this tool was written. Every one of them is the reason a rule exists.
// Keeping that contract in prose guarantees that one day something drops
// quietly out of it; keeping it here means a change that loses a known answer
// fails loudly and names what it lost.
//
// IT IS A TABLE, NOT A SCRIPT. Each answer declares where its material is, what
// rule must find it, and at what place. Adding an answer is adding a row.
// Weakening one means deleting a line that names a real defect, which is a
// thing somebody has to do on purpose.
//
// FOUR STATES, AND THE DIFFERENCE BETWEEN THEM IS THE POINT OF THE PROJECT:
//
//   LIVE           found in the real material, by the rule it belongs to
//   RECONSTRUCTED  found in a fixture rebuilt from the fixed code's own comment,
//                  because the defect never reached a commit of its own
//   SKIP           the material could not be reached, and the row says why
//   FAIL           the material was there and the answer was not
//
// A SKIP IS NEVER A PASS. The suite exits 2 and says so in a sentence. "Could
// not check" and "checked and fine" must not look alike — and if that rule is
// going to be enforced on other people's code it is enforced here first.
//
// MATERIAL. Three answers live in repositories that are not part of this one.
// Paths default to siblings of this repository and are overridable:
//     LC_ODD   an odd-one-out checkout          (answers 1 and 5)
//     LC_WEB   a VideoAnalyzerProWeb checkout   (answer 2)
// An absolute path would carry one machine's account name into a public
// repository and would be wrong for everyone else anyway.
//
// THIS SUITE READS TEST CODE, AND A DEFAULT RUN DOES NOT. Answers 1 and 5 are
// both in odd-one-out's own `test/known-answers.mjs`, and since the measurement
// in test/precision.json the default exclusions skip test directories, because a
// test file is not a layer. Every scan below therefore pins the fixture config,
// which turns the defaults off.
//
// That is a real cost and it is written down rather than quietly absorbed: two
// of the six defects this tool was built to find would not be found by somebody
// running it with no configuration. The exclusion is still right — twelve of the
// thirty findings read by hand were test code — but "right on balance" is not
// "free", and a contract that hid the difference would be the wrong contract.
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const CLI = path.join(REPO, 'bin', 'looks-clean.mjs');
const CONFIG = path.join(HERE, 'fixtures', 'golden.config.json');
const NEXT_TO_REPO = path.join(REPO, '..');

const ODD = process.env.LC_ODD || path.join(NEXT_TO_REPO, 'odd-one-out');
const WEB = process.env.LC_WEB || path.join(NEXT_TO_REPO, 'VideoAnalyzerProWeb');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-known-'));

const exists = p => { try { return fs.existsSync(p); } catch { return false; } };

/**
 * One scan, returning its findings.
 *
 * A FAILED READ IS REPORTED, NOT SWALLOWED — and that is answer 1 in miniature.
 * If this returns null quietly, every row below prints "not among ? findings":
 * a broken suite wearing the clothes of a suite that ran and found nothing.
 */
function scan(dir, extra = []) {
  const snap = path.join(TMP, 'run-' + Math.random().toString(36).slice(2) + '.json');
  const r = spawnSync(process.execPath,
    [CLI, 'scan', dir, ...extra, '--config', CONFIG, '--lang', 'en', '--json', snap],
    { encoding: 'utf8', maxBuffer: 1e9 });
  try {
    return { findings: JSON.parse(fs.readFileSync(snap, 'utf8')).findings, error: null };
  } catch (e) {
    return {
      findings: null,
      error: 'the scan wrote no snapshot (' + (e.code || e.message) + '; exit ' + r.status + ')',
    };
  }
}

// ------------------------------------------------------------------ material
// Each resolver answers { dir } or { skip }. They are memoised because two
// answers share one checkout and extracting it twice would double the slowest
// part of the suite.
const memo = new Map();
const once = (key, fn) => {
  if (!memo.has(key)) memo.set(key, fn());
  return memo.get(key);
};

const oddOneOutTests = () => once('odd', () => {
  const dir = path.join(ODD, 'test');
  if (!exists(dir)) return { skip: 'no checkout at ' + ODD + ' — set LC_ODD' };
  return { dir };
});

// The material for answer 2 is the revision BEFORE the fix. 44db12c is
// "Opinie i zgloszenia: trzy stany zamiast pustej listy"; its parent still has
// the collapse, and already has the three neighbours that make it a deviation.
const webBeforeFix = () => once('web', () => {
  if (!exists(WEB)) return { skip: 'no checkout at ' + WEB + ' — set LC_WEB' };
  const out = path.join(TMP, 'web-before');
  try {
    fs.mkdirSync(out, { recursive: true });
    const tar = execFileSync('git', ['archive', '44db12c^', 'main/src/web/js'],
      { cwd: WEB, maxBuffer: 5e8 });
    // EXTRACTED WITH A RELATIVE NAME, FROM INSIDE `out`, ON PURPOSE. `tar` on
    // Windows is either bsdtar or the GNU tar that ships with Git, and
    // whichever comes first on PATH decides. GNU tar reads an absolute Windows
    // path as a remote host spec and dies on the drive letter. No colon
    // reaches the command line this way.
    fs.writeFileSync(path.join(out, 'web.tar'), tar);
    execFileSync('tar', ['-xf', 'web.tar'], { cwd: out, stdio: 'ignore' });
    fs.rmSync(path.join(out, 'web.tar'), { force: true });
    const dir = path.join(out, 'main', 'src', 'web', 'js');
    if (!exists(dir)) return { skip: 'extracted 44db12c^ but no main/src/web/js inside it' };
    return { dir };
  } catch (e) {
    // Not swallowed. A broken fixture reporting itself as "material
    // unavailable" is answer 1, and committing it here would be a poor joke.
    return { skip: 'extracting 44db12c^ failed — ' +
      String(e.message).replace(/[\r\n]+/g, ' ').slice(0, 120) };
  }
});

const reconstructed = () => ({ dir: path.join(HERE, 'fixtures', 'known') });

// ------------------------------------------------------------------ the six
const ANSWERS = [
  {
    id: 1,
    name: 'swallowed catch read as "material unavailable"',
    source: 'odd-one-out — test/known-answers.mjs:77',
    cost: 'a fixture that would not extract reported itself as missing material, ' +
      'and the suite went green on a check that never ran',
    state: 'LIVE',
    material: oddOneOutTests,
    expect: { rule: 'swallowed', file: 'known-answers.mjs', line: 77 },
    // The neighbour fourteen lines below does record its reason, which is what
    // makes this a deviation rather than an opinion. Without a population the
    // finding is still produced, but as a bare observation — so the contract
    // asserts the comparison happened.
    also: f => (f.meta.peers > 0 ? null : 'reported with no neighbour comparison'),
  },
  {
    id: 2,
    name: 'my_reviews collapsed to an empty list',
    source: 'VideoAnalyzerProWeb — vap-account-panel.js at 44db12c^',
    cost: 'a paying customer with two reviews was shown "you have no reviews" ' +
      'whenever the backend hiccuped, and the credit counter beside it agreed',
    state: 'LIVE',
    material: webBeforeFix,
    expect: { rule: 'default-on-error', file: 'vap-account-panel.js', value: '[]' },
    also: f => (f.meta.safe >= 3 ? null : 'fewer than three distinguishing neighbours'),
  },
  {
    id: 3,
    name: 'storagePaths = [] on a failed select',
    source: 'dream_analyzer — supabase/functions/delete-account/index.ts',
    cost: 'a failed read left the path list empty, the next step deleted nothing, ' +
      'and the files stayed in the bucket after the account was gone',
    // RECONSTRUCTED, and the suite says so rather than implying a live check.
    // The defect was found and fixed inside the commit that introduced the
    // file, so there is no revision holding it; the fixture is rebuilt from the
    // comment the fix left behind, which quotes it.
    state: 'RECONSTRUCTED',
    material: reconstructed,
    expect: { rule: 'default-on-error', file: 'delete-account.ts', value: '[]' },
  },
  {
    id: 4,
    name: 'a corrupt migration file reported CLEAN',
    source: 'a SQL-migration checker, not JavaScript',
    cost: 'a migration that could not be read was reported as one with nothing wrong in it',
    // PERMANENTLY UNREACHABLE FOR THIS BUILD, and recorded as such. The answer
    // is real; this build reads .js and .ts only. Calling it "not found" would
    // be the tool's own defect: an absence of material printed as a checked
    // result.
    state: 'SKIP',
    material: () => ({
      skip: 'the checker is not JavaScript, and this build reads .js/.ts only — ' +
        'out of language scope, not missing',
    }),
  },
  {
    id: 5,
    name: 'a test that passed with nothing to check',
    source: 'odd-one-out — test/known-answers.mjs:46',
    cost: 'the snapshot read failed, the findings list stayed null, and every ' +
      'assertion below reported "not found" instead of "nothing ran"',
    state: 'LIVE',
    material: oddOneOutTests,
    expect: { rule: 'swallowed', file: 'known-answers.mjs', line: 46 },
  },
  {
    id: 6,
    name: 'an empty tree reported as clean code',
    source: 'this tool, and every tool of its class',
    cost: 'a scan of a directory it cannot read prints the same zero as a scan ' +
      'of a codebase with nothing wrong in it',
    // NOT A SITE IN SOMEBODY'S SOURCE. This one is a defect in a tool of this
    // kind, so it is checked against THIS tool: two runs, and the empty one has
    // to say something the healthy one does not.
    state: 'LIVE',
    verify: () => {
      const empty = path.join(TMP, 'empty-tree');
      fs.mkdirSync(empty, { recursive: true });
      const out = args => {
        const r = spawnSync(process.execPath, [CLI, 'scan', ...args, '--config', CONFIG, '--lang', 'en'],
          { encoding: 'utf8', maxBuffer: 1e9 });
        return (r.stdout || '') + (r.stderr || '');
      };
      const phrase = 'This is NOT the same as "nothing found"';
      const emptyOut = out([empty]);
      const healthyOut = out([path.join(HERE, 'fixtures', 'project')]);
      if (!emptyOut.includes(phrase))
        return { ok: false, detail: 'the empty run does not say it read nothing' };
      // The control: a phrase a healthy run also prints proves nothing.
      if (healthyOut.includes(phrase))
        return { ok: false, detail: 'a healthy run prints the same sentence, so it distinguishes nothing' };
      return { ok: true, detail: 'the empty run says what the healthy run does not' };
    },
  },
];

// ------------------------------------------------------------------ verify
function matches(f, expect) {
  if (f.rule !== expect.rule) return false;
  if (expect.file && !String(f.file).endsWith(expect.file)) return false;
  if (expect.line !== undefined && f.line !== expect.line) return false;
  if (expect.anchor !== undefined && f.anchor !== expect.anchor) return false;
  if (expect.value !== undefined && !(f.meta && f.meta.value === expect.value)) return false;
  return true;
}

const rows = [];
for (const a of ANSWERS) {
  if (a.verify) {
    const r = a.verify();
    rows.push({ ...a, result: r.ok ? a.state : 'FAIL', detail: r.detail });
    continue;
  }

  const m = a.material();
  if (m.skip) {
    rows.push({ ...a, result: 'SKIP', detail: m.skip });
    continue;
  }

  const { findings, error } = scan(m.dir);
  if (error) {
    rows.push({ ...a, result: 'FAIL', detail: error });
    continue;
  }

  const hit = findings.find(f => matches(f, a.expect));
  if (!hit) {
    const nearMisses = findings.filter(f => f.rule === a.expect.rule &&
      (!a.expect.file || String(f.file).endsWith(a.expect.file)));
    rows.push({
      ...a, result: 'FAIL',
      detail: 'not among ' + findings.length + ' findings' +
        (nearMisses.length ? '   (' + nearMisses.length + ' by the same rule in the same file, at ' +
          nearMisses.slice(0, 3).map(f => f.line).join(', ') + ')' : ''),
    });
    continue;
  }

  const complaint = a.also ? a.also(hit) : null;
  rows.push({
    ...a,
    result: complaint ? 'FAIL' : a.state,
    detail: complaint
      ? hit.file + ':' + hit.line + ' — ' + complaint
      : hit.file + ':' + hit.line + '   peers=' + (hit.meta.safe ?? 0) + '/' + (hit.meta.peers ?? 0),
  });
}

// ------------------------------------------------------------------ report
console.log('looks-clean — known answers (the contract)\n');
for (const r of rows) {
  console.log('  ' + r.result.padEnd(14) + String(r.id) + '. ' + r.name);
  console.log('  ' + ' '.repeat(14) + '   ' + r.source);
  console.log('  ' + ' '.repeat(14) + '   ' + r.detail);
}

const failed = rows.filter(r => r.result === 'FAIL');
const skipped = rows.filter(r => r.result === 'SKIP');
const found = rows.filter(r => r.result === 'LIVE' || r.result === 'RECONSTRUCTED');
console.log('\n  ' + found.length + ' found (' +
  found.filter(r => r.result === 'LIVE').length + ' live, ' +
  found.filter(r => r.result === 'RECONSTRUCTED').length + ' reconstructed), ' +
  failed.length + ' lost, ' + skipped.length + ' unreachable   (' + ANSWERS.length + ' answers)');

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }

if (failed.length) {
  console.log('\n  A known answer was lost. That is a regression, not a tuning question —');
  console.log('  each of these is the reason a rule exists.');
  for (const r of failed) console.log('    ' + r.id + '. ' + r.name + ' — ' + r.cost);
  process.exit(1);
}
if (skipped.length) {
  console.log('\n  Some material was unreachable, so this run proves nothing about those');
  console.log('  answers. That is not the same as their passing, and the exit code says so.');
  for (const r of skipped) console.log('    ' + r.id + '. ' + r.name + ' — ' + r.detail);
  process.exit(2);
}
