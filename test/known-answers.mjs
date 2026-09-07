// looks-clean — the known-answer regression suite.
//
// WHY THIS FILE EXISTS. Six defects were traced by hand, in real code, before a
// line of this tool was written. Every one of them is a reason a rule exists,
// and every one of them MUST still be found after any change. Keeping that
// contract in prose guarantees that one day something drops quietly out of it;
// keeping it here means a change that loses a known answer fails loudly.
//
// THREE STATES, AND THE MIDDLE ONE IS THE POINT OF THE WHOLE PROJECT:
//
//   LIVE          found in the real material, by the rule it is a known answer for
//   RECONSTRUCTED found in a fixture rebuilt from the fixed code's own comment,
//                 because the defect never reached a commit of its own
//   SKIP          the material could not be reached, and the reason says which
//
// A SKIP is never a pass and never silent: the suite exits 2, and the line says
// what would have to be supplied. "Could not check" and "checked and fine" must
// not look alike — which is the sentence this tool exists to enforce, and the
// first place to enforce it is here.
//
// MATERIAL. Four answers live in repositories that are not part of this one.
// Paths default to siblings of this repository and are overridable:
//     LC_ODD   an odd-one-out checkout   (answers 1 and 5)
//     LC_WEB   a VideoAnalyzerProWeb checkout (answer 2)
// An absolute path would carry one machine's account name into a public
// repository and be wrong for everyone else anyway.
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

const results = [];
const record = (name, state, detail) => results.push({ name, state, detail });
const exists = p => { try { return fs.existsSync(p); } catch { return false; } };

function run(args) {
  const snap = path.join(TMP, 'run-' + Math.random().toString(36).slice(2) + '.json');
  const r = spawnSync(process.execPath, [CLI, ...args, '--config', CONFIG, '--lang', 'en', '--json', snap],
    { encoding: 'utf8', maxBuffer: 1e9 });
  let findings = null;
  try { findings = JSON.parse(fs.readFileSync(snap, 'utf8')).findings; }
  catch (e) {
    // NOT SWALLOWED, and this is answer 1 in miniature. If this read fails and
    // says nothing, every check below reports "not among ? findings" — a
    // broken suite wearing the clothes of a suite that ran and found nothing.
    findings = null;
    record._lastReadError = String(e.code || e.message);
  }
  return { findings, stdout: r.stdout || '', stderr: r.stderr || '', status: r.status };
}

const describe = (findings, extra = '') =>
  (findings === null
    ? 'the run wrote no snapshot' + (record._lastReadError ? ' (' + record._lastReadError + ')' : '')
    : 'not among ' + findings.length + ' findings') + extra;

// ------------------------------------------------------------------ 1 and 5
// Both live in odd-one-out's own test/known-answers.mjs, and they are the two
// halves of one story. The `git show` at line 77 is wrapped in a catch that
// keeps nothing, so a broken fixture reported itself as "material unavailable"
// and the suite went green on a check that never ran. Fourteen lines below it,
// the sibling case for the same kind of extraction records the reason into
// `why` — which is the neighbour that makes this a deviation rather than an
// opinion.
{
  const dir = path.join(ODD, 'test');
  if (!exists(dir)) {
    const why = 'no checkout at ' + ODD + ' — set LC_ODD';
    record('swallowed catch reads as "material unavailable"', 'SKIP', why);
    record('a test that passed with nothing to check', 'SKIP', why);
  } else {
    const { findings } = run(['scan', dir]);
    const at = line => (findings || []).find(f =>
      f.rule === 'swallowed' && f.file.endsWith('known-answers.mjs') && f.line === line);

    // The catch around `git show <rev>:main/pom.xml`.
    const gitShow = at(77);
    record('swallowed catch reads as "material unavailable"',
      gitShow ? 'LIVE' : 'FAIL',
      gitShow
        ? gitShow.file + ':' + gitShow.line + '   peers=' +
          (gitShow.meta.safe || 0) + '/' + (gitShow.meta.peers || 0)
        : describe(findings));

    // The catch around `JSON.parse` of the snapshot: when it fires, `findings`
    // stays null and every later assertion reads "not found" instead of "the
    // run produced nothing".
    const jsonParse = at(46);
    record('a test that passed with nothing to check',
      jsonParse ? 'LIVE' : 'FAIL',
      jsonParse ? jsonParse.file + ':' + jsonParse.line : describe(findings));
  }
}

// ------------------------------------------------------------------ 2
// `my_reviews` collapsing to an empty list. Fixed by 44db12c ("Opinie i
// zgloszenia: trzy stany zamiast pustej listy"), so the material is that
// commit's parent. Three neighbouring reads in the same block already answered
// { known, value } at the time, which is what makes the fourth a deviation.
{
  const out = path.join(TMP, 'web-before');
  let ready = false;
  let why = 'no checkout at ' + WEB + ' — set LC_WEB';
  if (exists(WEB)) {
    try {
      fs.mkdirSync(out, { recursive: true });
      const tar = execFileSync('git', ['archive', '44db12c^', 'main/src/web/js'],
        { cwd: WEB, maxBuffer: 5e8 });
      // EXTRACTED WITH A RELATIVE NAME, FROM INSIDE `out`, ON PURPOSE. `tar` on
      // Windows is either bsdtar or the GNU tar that ships with Git, and
      // whichever comes first on PATH decides. GNU tar reads an absolute
      // Windows path as a remote host spec and dies on the drive letter. No
      // colon reaches the command line this way.
      fs.writeFileSync(path.join(out, 'web.tar'), tar);
      execFileSync('tar', ['-xf', 'web.tar'], { cwd: out, stdio: 'ignore' });
      fs.rmSync(path.join(out, 'web.tar'), { force: true });
      ready = exists(path.join(out, 'main', 'src', 'web', 'js'));
      if (!ready) why = 'extracted 44db12c^ but no main/src/web/js inside it';
    } catch (e) {
      // Not swallowed: a broken fixture must not read as "material unavailable".
      // That is answer 1, and repeating it here would be a poor joke.
      why = 'extracting 44db12c^ failed — ' +
        String(e.message).replace(/[\r\n]+/g, ' ').slice(0, 120);
    }
  }
  if (!ready) {
    record('my_reviews collapsed to an empty list', 'SKIP', why);
  } else {
    const { findings } = run(['scan', path.join(out, 'main', 'src', 'web', 'js')]);
    const hit = (findings || []).find(f =>
      f.rule === 'default-on-error' &&
      f.file.endsWith('vap-account-panel.js') &&
      f.meta && f.meta.value === '[]');
    record('my_reviews collapsed to an empty list',
      hit ? 'LIVE' : 'FAIL',
      hit ? hit.file + ':' + hit.line + '   peers=' + hit.meta.safe + '/' + hit.meta.peers
        : describe(findings));
  }
}

// ------------------------------------------------------------------ 3
// storagePaths = [] on a failed select. Reconstructed, because the defect was
// found and fixed inside the commit that introduced the file — there is no
// revision holding it. See the header of the fixture for the comment it is
// rebuilt from.
{
  const { findings } = run(['scan', path.join(HERE, 'fixtures', 'known')]);
  const hit = (findings || []).find(f =>
    f.rule === 'default-on-error' && f.file.endsWith('delete-account.ts') &&
    f.meta && f.meta.value === '[]');
  record('storagePaths = [] on a failed select',
    hit ? 'RECONSTRUCTED' : 'FAIL',
    hit ? hit.file + ':' + hit.line + '   peers=' + hit.meta.safe + '/' + hit.meta.peers
      : describe(findings));
}

// ------------------------------------------------------------------ 4
// A corrupt migration file reporting CLEAN. The checker that produced that
// verdict is not JavaScript, and this build reads JavaScript and TypeScript
// only — see the README on why one language first. Recorded as unreachable
// rather than as absent: the answer is real, this build cannot see it, and the
// difference between those two is the whole subject of the tool.
record('a corrupt migration file reported CLEAN', 'SKIP',
  'the checker is not JavaScript; this build reads .js/.ts only — the answer is ' +
  'out of language scope, not missing');

// ------------------------------------------------------------------ 6
// An empty directory reporting rules=0, indistinguishable from clean code.
// This one is not a site in somebody's source: it is a defect in a tool of this
// kind, so it is checked against THIS tool. Two runs, and the empty one has to
// say something the healthy one does not.
{
  const empty = path.join(TMP, 'empty-tree');
  fs.mkdirSync(empty, { recursive: true });
  const a = spawnSync(process.execPath, [CLI, 'scan', empty, '--config', CONFIG, '--lang', 'en'],
    { encoding: 'utf8' });
  const b = spawnSync(process.execPath,
    [CLI, 'scan', path.join(HERE, 'fixtures', 'project'), '--config', CONFIG, '--lang', 'en'],
    { encoding: 'utf8' });
  const emptyOut = (a.stdout || '') + (a.stderr || '');
  const healthyOut = (b.stdout || '') + (b.stderr || '');
  const phrase = 'This is NOT the same as "nothing found"';
  const spoke = emptyOut.includes(phrase) && !healthyOut.includes(phrase);
  record('an empty tree reported as clean code', spoke ? 'LIVE' : 'FAIL',
    spoke ? 'the empty run says what the healthy run does not'
      : 'the empty run said nothing a healthy run does not say');
}

// ------------------------------------------------------------------ report
console.log('looks-clean — known answers\n');
for (const r of results)
  console.log('  ' + r.state.padEnd(14) + r.name.padEnd(48) + r.detail);

const failed = results.filter(r => r.state === 'FAIL').length;
const skipped = results.filter(r => r.state === 'SKIP').length;
const passed = results.filter(r => r.state === 'LIVE' || r.state === 'RECONSTRUCTED').length;
console.log('\n  ' + passed + ' found, ' + failed + ' lost, ' + skipped + ' unreachable');

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }

if (failed) {
  console.log('\n  A known answer was lost. That is a regression, not a tuning question.');
  process.exit(1);
}
if (skipped) {
  console.log('\n  Some material was unreachable — this run proves nothing about those answers.');
  process.exit(2);
}
