// looks-clean — layer 5: the output depends on the input.
//
// WHAT THIS ADDS OVER THE GOLDEN LAYER. Golden tests pin one output for one
// input. They prove the tool still says the same thing; they do not prove it
// says anything ABOUT the input. A detector hard-wired to report exactly seven
// findings from test/fixtures/project would pass every golden test in this
// repository, and so would one that had stopped reading the files and was
// replaying a recording.
//
// So each case perturbs the fixture in a way whose consequence is known in
// advance, and the result must move in the predicted direction:
//
//   take a deadline away    -> no-timeout must rise
//   give the bare read one  -> no-timeout must fall to zero
//   make a handler tagged   -> default-on-error must fall
//   make a swallower log    -> swallowed must fall
//   make a collision throw  -> same-answer must fall
//   add a second collapse   -> default-on-error must rise
//   delete the neighbours   -> the finding must become a passed-over site
//
// EVERY CASE IS ITS OWN NEGATIVE CHECK. A perturbation whose result does not
// move is a failure even when the tool "worked": it means the output does not
// depend on the thing that was changed, and a measurement that cannot tell the
// difference is measuring its own echo.
//
// THE LAST CASE IS THE ONE THAT MATTERS MOST. Deleting the neighbours must not
// turn a finding into silence — it must turn it into a site the run says it
// passed over. That is the difference between "checked and fine" and "could not
// check", enforced on the tool that enforces it on everybody else.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CLI = path.join(ROOT, 'bin', 'looks-clean.mjs');
const CONFIG = path.join(HERE, 'fixtures', 'golden.config.json');
const FIXTURE = path.join(HERE, 'fixtures', 'project');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-amp-'));

let failed = 0;
let n = 0;

// The fixtures themselves are never touched: every case works on a copy. A
// suite that edited test/fixtures/ would break the golden layer the moment it
// crashed halfway.
function freshCopy(label) {
  const d = path.join(TMP, label + '-' + (++n));
  fs.mkdirSync(d, { recursive: true });
  for (const e of fs.readdirSync(FIXTURE, { withFileTypes: true }))
    if (e.isFile()) fs.copyFileSync(path.join(FIXTURE, e.name), path.join(d, e.name));
  return d;
}

/**
 * A perturbation that does not apply is a failed test, not a skipped one. The
 * fixture text drifts, the `replace` silently matches nothing, and the case
 * then "passes" by comparing a number with itself.
 */
function edit(dir, file, from, to) {
  const p = path.join(dir, file);
  const s = fs.readFileSync(p, 'utf8');
  if (!s.includes(from))
    throw new Error('perturbation did not apply in ' + file + ': ' + from.slice(0, 60));
  fs.writeFileSync(p, s.replace(from, to));
}

function measure(dir) {
  const snap = path.join(TMP, 'm-' + Math.random().toString(36).slice(2) + '.json');
  const r = spawnSync(process.execPath,
    [CLI, 'scan', dir, '--config', CONFIG, '--lang', 'en', '--verbose', '--json', snap],
    { encoding: 'utf8', maxBuffer: 1e9 });
  if (!fs.existsSync(snap)) throw new Error('no snapshot (exit ' + r.status + ')');
  const s = JSON.parse(fs.readFileSync(snap, 'utf8'));
  const byRule = {};
  for (const f of s.findings) byRule[f.rule] = (byRule[f.rule] || 0) + 1;
  return { byRule, findings: s.findings, out: (r.stdout || '') + (r.stderr || '') };
}

const base = measure(freshCopy('base'));

console.log('looks-clean — amplification: the output depends on the input\n');
console.log('  baseline: ' +
  Object.entries(base.byRule).map(([k, v]) => k + '=' + v).join('  ') + '\n');

/**
 * @param rule      the rule whose count must move
 * @param direction 'up' | 'down' | 'gone'
 */
// A count is scoped to a FILE where the fixture has more than one site under
// the same rule. Silencing readManifest took the swallowed count from 2 to 1,
// not to 0, because api.js has one too — and a whole-run count would have made
// that read as a half-working perturbation instead of a precise one.
function amplifies(name, rule, direction, perturb, file) {
  let got;
  try {
    const dir = freshCopy(name.replace(/\W+/g, '-').slice(0, 20));
    perturb(dir);
    got = measure(dir);
  } catch (e) {
    failed++;
    console.log('  FAIL  ' + name.padEnd(46) + String(e.message).slice(0, 60));
    return null;
  }
  const count = m => (file ? m.findings.filter(f => f.rule === rule && f.file.endsWith(file)).length
    : (m.byRule[rule] || 0));
  const before = count(base);
  const after = count(got);
  const ok = direction === 'up' ? after > before
    : direction === 'down' ? after < before
      : after === 0 && before > 0;
  if (!ok) failed++;
  console.log('  ' + (ok ? 'ok    ' : 'FAIL  ') + name.padEnd(46) +
    rule + (file ? ' in ' + file : '') + ': ' + before + ' -> ' + after +
    '   (expected ' + direction + ')');
  return got;
}

// ---------------------------------------------------------------- rule 3
amplifies('take saveDream\'s deadline away', 'no-timeout', 'up', dir =>
  edit(dir, 'net.js', "    signal: AbortSignal.timeout(8000),\n  });\n  return res.json();\n}\n\n// THE PLANTED DEVIATION",
    "  });\n  return res.json();\n}\n\n// THE PLANTED DEVIATION"));

amplifies('give saveProfile a deadline', 'no-timeout', 'gone', dir =>
  edit(dir, 'net.js', "    body: JSON.stringify(body),\n  });\n  return res.json();\n}\n\nasync function saveNote",
    "    body: JSON.stringify(body),\n    signal: AbortSignal.timeout(8000),\n  });\n  return res.json();\n}\n\nasync function saveNote"));

// ---------------------------------------------------------------- rule 2
amplifies('make loadReviews carry its outcome', 'default-on-error', 'down', dir =>
  edit(dir, 'api.js', ".catch(function () { return []; });",
    ".catch(function () { return { known: false, value: [] }; });"));

amplifies('add a second collapsing handler', 'default-on-error', 'up', dir =>
  edit(dir, 'api.js', "module.exports = { loadProfile",
    "function loadDrafts(sb) {\n" +
    "  return sb.rpc('my_drafts')\n" +
    "    .then(function (r) { return r.data || []; })\n" +
    "    .catch(function () { return []; });\n" +
    "}\n\nmodule.exports = { loadProfile"));

// ---------------------------------------------------------------- rule 1
amplifies('make readManifest say something', 'swallowed', 'gone', dir =>
  edit(dir, 'disk.js', "  } catch {\n    /* no manifest is fine */\n  }",
    "  } catch (e) {\n    console.warn('no manifest: ' + e.code);\n  }"), 'disk.js');

// ---------------------------------------------------------------- rule 4
amplifies('make readEntries throw on failure', 'same-answer', 'gone', dir =>
  edit(dir, 'store.js', "    console.error('readEntries failed', e);\n    return [];",
    "    console.error('readEntries failed', e);\n    throw e;"));

// ---------------------------------------------------------------- population
//
// THE CASE THIS LAYER EXISTS FOR. Removing the neighbours must not make the
// finding disappear quietly: the site is still there, still bare, and the run
// has to say it was passed over rather than say nothing.
{
  let ok = true, detail = '';
  try {
    const dir = freshCopy('no-neighbours');
    // Leave saveProfile alone with one guarded neighbour: two reads is below
    // the default minpop of three, so no comparison is possible.
    const net = fs.readFileSync(path.join(dir, 'net.js'), 'utf8');
    const cut = net.slice(0, net.indexOf('async function saveNote')) +
      'module.exports = { saveDream, saveProfile };\n';
    fs.writeFileSync(path.join(dir, 'net.js'), cut);
    const got = measure(dir);

    const stillReported = (got.byRule['no-timeout'] || 0) > 0;
    const passedOver = /saveProfile reads fetch with no time limit[^\n]*only 2 peer/.test(got.out);
    const counted = /passed over for want of neighbours: \d/.test(got.out);

    ok = !stillReported && passedOver && counted;
    detail = 'no-timeout: ' + (base.byRule['no-timeout'] || 0) + ' -> ' +
      (got.byRule['no-timeout'] || 0) +
      (passedOver ? ', and the site is named as passed over' : ', and the site vanished in silence');
  } catch (e) {
    ok = false;
    detail = String(e.message).slice(0, 70);
  }
  if (!ok) failed++;
  console.log('  ' + (ok ? 'ok    ' : 'FAIL  ') +
    'delete the neighbours: reported -> passed over'.padEnd(46) + detail);
}

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }

console.log('\n  ' + (failed ? failed + ' failed' : 'every perturbation moved the result'));
if (failed) {
  console.log('\n  A result that does not move when the input does is not a measurement.');
  process.exit(1);
}
