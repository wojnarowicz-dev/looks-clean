// looks-clean — failure resilience, applied to itself.
//
// ONE CRITERION: fail loudly, or carry on — never quietly return zero.
//
// This suite is not a general good practice here; it is the tool's own subject
// turned on the tool. Every rule in this project reports somebody else's code
// for answering "nothing found" when it meant "could not check". A scanner that
// hits a broken file, reads nothing, prints `findings: 0` and exits 0 has
// committed exactly that, and its own rules cannot see it.
//
// Each scenario damages something on purpose, then the run is classified:
//
//   CRASH   the process died — loud, but not on purpose
//   LOUD    exit 2, the tool's code for "your input is the problem"
//   SPOKE   ran normally (exit 0 or 1) and said something a healthy run does not
//   SILENT  ran normally and said nothing new                <-- the failure
//
// EVERY SCENARIO RUNS TWICE: once damaged, once healthy. A phrase counts as
// speaking about the damage only if it appears in the damaged run AND NOT in
// the healthy one. This is the correction of two measurement errors that are
// easy to make and invisible once made:
//
//   * exit codes read as alarms. Exit 1 means "findings were reported", and the
//     fixture has four planted deviations, so exit 1 arrives whether or not the
//     damage was noticed.
//   * keywords that a healthy run also prints. "snapshot" matches the ordinary
//     line `run snapshot saved`, so a scenario about a damaged snapshot passes
//     while being entirely silent about it.
//
// A criterion a healthy run satisfies measures nothing. The control run makes
// that impossible to get wrong by choosing words carelessly.
//
// A scenario whose damage cannot be staged on this machine reports SKIP with the
// reason. It is never counted as a pass — "could not test" and "tested fine"
// must not look alike either.
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CLI = path.join(ROOT, 'bin', 'looks-clean.mjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-resil-'));

// Fixtures are copied rather than damaged in place: a test that mutated
// test/fixtures/ would break the golden suite the moment it crashed halfway.
// The copies also sit outside the repository, so the root .looks-clean.json —
// which excludes test/fixtures so self-check stays quiet — does not reach them.
function copyFixture(name, into) {
  fs.mkdirSync(into, { recursive: true });
  const from = path.join(HERE, 'fixtures', name);
  for (const e of fs.readdirSync(from, { withFileTypes: true }))
    if (e.isFile()) fs.copyFileSync(path.join(from, e.name), path.join(into, e.name));
  return into;
}

let counter = 0;
const dir = n => {
  const d = path.join(TMP, n + '-' + (++counter));
  fs.mkdirSync(d, { recursive: true });
  return d;
};

/** An undamaged copy of the fixture project, for the control run. */
const pristine = () => ['scan', copyFixture('project', dir('healthy'))];

function run(args) {
  const r = spawnSync(process.execPath, [CLI, ...args],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1e9 });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

// ---------------------------------------------------------------- scenarios
const SCENARIOS = [];
const scenario = (name, damage, build, speaks, control = pristine) =>
  SCENARIOS.push({ name, damage, build, speaks, control });

scenario('empty directory', 'nothing to read at all',
  () => ['scan', dir('empty')],
  ['No .js/.ts/.html files', 'nothing to read']);

// THE ONE THIS TOOL IS ABOUT. Files were read, sites were found, and not one
// peer group was large enough to compare against. Three of the four rules then
// have nothing to say, and the run is over. If that prints `findings: 0` and
// stops, the tool has told the reader their code is fine on the strength of
// having checked nothing.
scenario('nothing to compare against', 'sites read, no peer group big enough',
  () => {
    const d = dir('lonely');
    fs.writeFileSync(path.join(d, 'only.js'),
      'async function one(u) {\n  const r = await fetch(u);\n  return r.json();\n}\n');
    return ['scan', d, '--minpop', '9'];
  },
  ['not one peer group', 'NOT a clean bill of health']);

// THE ONE A MEASUREMENT FOUND, AND THE WORST THIS TOOL HAS HAD.
//
// Pointed at node-red, the tool read 11 files of a repository holding 308
// JavaScript sources and printed `findings: 0`. node-red keeps its source under
// `packages/node_modules/`, and the built-in `**/node_modules/**` exclusion
// removed the entire project without a word. `findings: 0` meaning "I did not
// look" is exactly the defect these four rules report in other people's code.
//
// The fixture reproduces the layout rather than the project: a handful of files
// at the top, and the real code one directory down under a name the exclusions
// eat.
scenario('sources under an excluded directory', 'the whole project is behind an exclusion',
  () => {
    const d = dir('hidden-sources');
    fs.writeFileSync(path.join(d, 'index.js'), 'module.exports = require("./packages/node_modules/app");\n');
    const inner = path.join(d, 'packages', 'node_modules', 'app');
    fs.mkdirSync(inner, { recursive: true });
    const src = fs.readFileSync(path.join(HERE, 'fixtures', 'project', 'api.js'), 'utf8');
    for (const n of ['api.js', 'net.js', 'store.js', 'disk.js'])
      fs.copyFileSync(path.join(HERE, 'fixtures', 'project', n), path.join(inner, n));
    void src;
    return ['scan', d];
  },
  ['not read:', 'More was excluded than was read', 'node_modules']);

scenario('binary junk in a .js file', 'one source file is not source at all',
  () => {
    const d = copyFixture('project', dir('junk'));
    const junk = Buffer.alloc(2048);
    for (let i = 0; i < junk.length; i++) junk[i] = (i * 37) % 256;
    fs.writeFileSync(path.join(d, 'broken.js'), junk);
    return ['scan', d];
  },
  ['broken.js', 'did not parse cleanly']);

scenario('truncated source file', 'a module that stops mid-function',
  () => {
    const d = copyFixture('project', dir('truncated'));
    const s = fs.readFileSync(path.join(d, 'store.js'), 'utf8');
    fs.writeFileSync(path.join(d, 'half.js'), s.slice(0, Math.floor(s.length / 2)));
    return ['scan', d];
  },
  ['half.js', 'did not parse cleanly']);

scenario('non-UTF-8 source (cp1250)', 'bytes that are not valid UTF-8',
  () => {
    const d = copyFixture('project', dir('cp1250'));
    // Windows-1250 bytes for a Polish comment. 0x9c 0xe6 0xb3 0xea are not
    // valid UTF-8, and Node replaces each with U+FFFD when read as utf8 —
    // silently, which is the point.
    const head = Buffer.from('// zapisano w cp1250: ', 'utf8');
    const bytes = Buffer.from([0x9c, 0xe6, 0xb3, 0xea, 0x0a]);
    const tail = Buffer.from('\nfunction cp1250() { return 1; }\n', 'utf8');
    fs.writeFileSync(path.join(d, 'cp1250.js'), Buffer.concat([head, bytes, tail]));
    return ['scan', d];
  },
  ['outside UTF-8', 'spoza UTF-8', 'cp1250.js']);

// DENYING A READ IS PLATFORM WORK, AND KNOWING ONLY ONE PLATFORM COST A LAYER.
//
// The first version used `icacls` and nothing else. On Windows it staged the
// damage and the scenario ran; on Linux `icacls` does not exist, the scenario
// reported SKIP, and a SKIP makes this whole layer exit 2 — so on any CI runner
// the resilience layer would have said "could not check" for a reason that had
// nothing to do with the tool. The suite would have been amber for the wrong
// reason, which is a way of hiding the right one.
//
// `chmod 000` is the POSIX equivalent and it works on a GitHub runner, which
// runs as an unprivileged user. It does NOT work for root — root ignores the
// mode bits — so that case is detected and reported as a SKIP with its own
// reason rather than passing on a read that was never actually blocked.
scenario('unreadable source file', 'read permission denied',
  () => {
    const d = copyFixture('project', dir('denied'));
    const target = path.join(d, 'locked.js');
    fs.copyFileSync(path.join(d, 'store.js'), target);

    if (process.platform === 'win32') {
      const who = process.env.USERNAME || process.env.USER;
      if (!who) return { skip: 'no USERNAME to deny' };
      try {
        execFileSync('icacls', [target, '/deny', who + ':(R)'], { stdio: 'ignore' });
      } catch (e) {
        return { skip: 'icacls failed: ' + String(e.message).slice(0, 60) };
      }
    } else {
      try {
        fs.chmodSync(target, 0o000);
      } catch (e) {
        return { skip: 'chmod failed: ' + String(e.message).slice(0, 60) };
      }
    }

    // THE STAGING IS VERIFIED, NOT ASSUMED. A scenario that believes it has
    // denied a read it has not denied is a test measuring a healthy run — the
    // exact mistake the control runs in this file exist to prevent.
    try {
      fs.readFileSync(target);
      return {
        skip: process.platform === 'win32'
          ? 'icacls /deny did not actually block reading'
          : 'chmod 000 did not block reading (running as root?)',
      };
    } catch {
      return ['scan', d];
    }
  },
  ['locked.js', 'EPERM', 'EACCES', 'cannot be read']);

scenario('unreadable config file', 'settings that will not parse',
  () => {
    const d = copyFixture('project', dir('badconfig'));
    const cfg = path.join(d, 'cfg.json');
    fs.writeFileSync(cfg, '{ "exclude": [ "**/x/**",');
    return ['scan', d, '--config', cfg];
  },
  ['Could not read', 'default settings']);

// A snapshot damaged the way an interrupted write leaves it. The control uses a
// snapshot written properly by a first run, so everything the tool prints about
// a healthy comparison is subtracted.
scenario('truncated snapshot to diff against', 'previous run cut in half',
  () => {
    const d = copyFixture('project', dir('cut-snapshot'));
    const snap = path.join(d, 'run.json');
    fs.writeFileSync(snap, '{\n  "version": 1,\n  "detector": "scan",\n  "findings": [\n    {"id": "abc');
    return ['scan', d, '--json', snap];
  },
  ['could not be read', 'nothing to compare with'],
  () => {
    const d = copyFixture('project', dir('good-snapshot'));
    const snap = path.join(d, 'run.json');
    run(['scan', d, '--json', snap]);            // a real previous run
    return ['scan', d, '--json', snap];
  });

scenario('snapshot from a future version', 'a version the tool does not know',
  () => {
    const d = copyFixture('project', dir('future-snapshot'));
    const snap = path.join(d, 'run.json');
    fs.writeFileSync(snap, JSON.stringify(
      { version: 999, tool: 'looks-clean', detector: 'scan', findings: [] }));
    return ['scan', d, '--json', snap];
  },
  ['could not be read', 'nothing to compare with'],
  () => {
    const d = copyFixture('project', dir('good-snapshot2'));
    const snap = path.join(d, 'run.json');
    run(['scan', d, '--json', snap]);
    return ['scan', d, '--json', snap];
  });

scenario('--json points at a directory', 'the snapshot cannot be written',
  () => {
    const d = copyFixture('project', dir('snap-dir'));
    return ['scan', d, '--json', dir('this-is-a-directory')];
  },
  ['EISDIR', 'that is a directory'],
  () => {
    const d = copyFixture('project', dir('snap-file'));
    return ['scan', d, '--json', path.join(d, 'run.json')];
  });

scenario('root does not exist', 'the scanned path is not there',
  () => ['scan', path.join(TMP, 'not-here')],
  ['not-here']);

scenario('unknown rule name', 'a flag value the tool does not know',
  () => ['scan', copyFixture('project', dir('bad-rule')), '--rule', 'no-such-rule'],
  ['Unknown rule']);

scenario('unknown layer name', 'a flag value the tool does not know',
  () => ['scan', copyFixture('project', dir('bad-layer')), '--layer', 'galaxy'],
  ['Unknown layer']);

// ---------------------------------------------------------------- run
console.log('looks-clean — failure resilience\n');
const rows = [];
for (const s of SCENARIOS) {
  let args;
  try { args = s.build(); } catch (e) { args = { skip: String(e.message).slice(0, 70) }; }
  if (args && args.skip) { rows.push({ ...s, state: 'SKIP', detail: args.skip }); continue; }

  const damaged = run(args);
  const healthy = run(s.control());

  // The phrase has to DISTINGUISH. Present in both means it says nothing about
  // the damage, however alarming it reads.
  const said = s.speaks.filter(k => damaged.out.includes(k) && !healthy.out.includes(k));
  const useless = s.speaks.filter(k => damaged.out.includes(k) && healthy.out.includes(k));

  const status = damaged.status;
  const state = (status !== 0 && status !== 1 && status !== 2) ? 'CRASH'
    : status === 2 ? 'LOUD'
      : said.length ? 'SPOKE' : 'SILENT';

  let detail = 'exit ' + status;
  if (state === 'SPOKE') detail += '   "' + said[0] + '"';
  if (state === 'SILENT' && useless.length)
    detail += '   ("' + useless[0] + '" also printed by a healthy run)';
  rows.push({ ...s, state, detail });
}

for (const r of rows) console.log('  ' + r.state.padEnd(7) + r.name.padEnd(36) + r.detail);

// ---------------------------------------------------------------- property
// THE NEGATIVE CHECK FOR THE TWO-PHASE WRITE. What temp-file-and-rename buys is
// one property: a write that fails does not destroy the snapshot already there.
// Asserting it needs the write to fail AFTER the run has produced its results,
// which cannot be staged from outside the process — so this one calls
// writeSnapshot directly.
//
// The temp path is predictable in-process (".<name>.tmp-<pid>", and the pid is
// ours), so putting a directory in its place makes the write fail at exactly the
// moment that matters. Under a single-phase write there would be no temp file,
// the target would have been truncated first, and the baseline would be gone.
let propertyFailed = false;
{
  const { writeSnapshot } = await import('../src/snapshot.mjs');
  const d = dir('write-property');
  const target = path.join(d, 'run.json');
  const good = { version: 1, tool: 'looks-clean', detector: 'scan', root: d, args: [], counts: {}, findings: [] };

  writeSnapshot(target, good);
  const before = fs.readFileSync(target, 'utf8');

  fs.mkdirSync(path.join(d, '.' + path.basename(target) + '.tmp-' + process.pid));

  const keep = process.exitCode;
  const result = writeSnapshot(target, { ...good, findings: [{ id: 'new' }] });
  process.exitCode = keep;                       // the suite decides its own code

  const after = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  const survived = after === before;
  const refused = result === null;

  console.log('');
  console.log('  (the write failure printed just above is this check working, not a fault)');
  console.log('  ' + (survived && refused ? 'PASS  ' : 'FAIL  ') +
    'a failed write leaves the previous snapshot intact   ' +
    (survived ? 'baseline whole' : 'BASELINE DAMAGED') +
    (refused ? ', write refused' : ', write claimed success'));
  propertyFailed = !(survived && refused);
}

const silent = rows.filter(r => r.state === 'SILENT');
const crashed = rows.filter(r => r.state === 'CRASH');
const skipped = rows.filter(r => r.state === 'SKIP');
const loud = rows.filter(r => r.state === 'LOUD').length;
const spoke = rows.filter(r => r.state === 'SPOKE').length;

console.log('\n  ' + loud + ' loud, ' + spoke + ' spoke, ' + crashed.length + ' CRASH, ' +
  silent.length + ' SILENT' + (skipped.length ? ', ' + skipped.length + ' skipped' : ''));

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* denied ACLs may resist */ }

if (crashed.length) {
  console.log('\n  Crashed:');
  for (const r of crashed)
    console.log('    ' + r.name + ' — ' + r.damage + ', and the process died instead of saying so');
}
if (silent.length) {
  console.log('\n  Silent zeros:');
  for (const r of silent) console.log('    ' + r.name + ' — ' + r.damage + ', and nothing said');
  console.log('\n  A run that returns nothing without saying why cannot be told from a clean run.');
  console.log('  That is the defect this whole tool reports in other people\'s code.');
}
if (silent.length || crashed.length || propertyFailed) process.exit(1);
if (skipped.length) process.exit(2);
