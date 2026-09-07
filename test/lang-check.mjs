// looks-clean — the two languages have not drifted apart.
//
// WHY THIS IS A TEST AND NOT A CONVENTION. A missing translation is invisible to
// whoever added the message, because they read the language they wrote it in.
// The only reader who sees it is the one this tool is not being written for at
// that moment. That is the same asymmetry the tool reports in other people's
// code: the failure lands on somebody who is not in the room.
//
// Three checks:
//   1. every key has both languages, and neither is empty
//   2. the {0}, {1} slots match, so no argument goes missing in one language
//   3. no source file prints a sentence that never passed through `t()`
//
// Check 3 is the one that keeps finding things. Four neighbour notes —
// "logs it", "rethrows", "answers with the outcome attached" — were written
// inline in the rule files, so `--lang pl` printed its headings in Polish and
// its evidence in English. Nothing was broken; the report was simply half
// translated, and only a Polish reader would ever have noticed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABLE, KEYS } from '../src/lang.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');

let failed = 0;
console.log('looks-clean — language check\n');

// ---------------------------------------------------------------- 1 and 2
const missing = [];
const slotMismatch = [];
for (const k of KEYS) {
  const e = TABLE[k];
  for (const lang of ['en', 'pl'])
    if (!e[lang] || !String(e[lang]).trim()) missing.push(k + ' [' + lang + ']');
  if (e.en && e.pl) {
    const slots = s => [...String(s).matchAll(/\{(\d+)\}/g)].map(m => m[1]).sort().join(',');
    if (slots(e.en) !== slots(e.pl))
      slotMismatch.push(k + ': en{' + slots(e.en) + '} vs pl{' + slots(e.pl) + '}');
  }
}
console.log('  ' + (missing.length ? 'FAIL  ' : 'PASS  ') +
  KEYS.length + ' keys, both languages present' +
  (missing.length ? '   missing: ' + missing.slice(0, 8).join(', ') : ''));
if (missing.length) failed++;

console.log('  ' + (slotMismatch.length ? 'FAIL  ' : 'PASS  ') +
  'argument slots match between languages' +
  (slotMismatch.length ? '   ' + slotMismatch.slice(0, 6).join('; ') : ''));
if (slotMismatch.length) failed++;

// ---------------------------------------------------------------- 3
// A console line whose argument is a bare quoted sentence has bypassed the
// dictionary. Identifiers, paths, punctuation and the separators the report is
// assembled from are not sentences and are allowed; anything with two words of
// prose in it is not.
const SOURCES = [];
const walk = d => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (/\.mjs$/.test(e.name)) SOURCES.push(p);
  }
};
walk(path.join(REPO, 'src'));
walk(path.join(REPO, 'bin'));

// `lang.mjs` holds the dictionary itself; `usage.mjs` prints the literal command
// lines of the examples, which are commands and not prose.
const EXEMPT = new Set([
  path.join(REPO, 'src', 'lang.mjs'),
  path.join(REPO, 'bin', 'usage.mjs'),
]);

const PROSE = /^[^'"`]*?(console\.(log|error|warn))\s*\(\s*(['"])([^'"]{12,})\3/;
const looksLikeProse = s =>
  /[a-z]{3,}\s+[a-z]{3,}\s+[a-z]{3,}/i.test(s) && !/^[\s\-=*#.]+$/.test(s);

const bypasses = [];
for (const f of SOURCES) {
  if (EXEMPT.has(f)) continue;
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    const m = PROSE.exec(trimmed);
    if (m && looksLikeProse(m[4]))
      bypasses.push(path.relative(REPO, f).replace(/\\/g, '/') + ':' + (i + 1) + '  ' + m[4].slice(0, 60));
  });
}

console.log('  ' + (bypasses.length ? 'FAIL  ' : 'PASS  ') +
  SOURCES.length + ' source files print only through the dictionary');
for (const b of bypasses.slice(0, 10)) console.log('        ' + b);
if (bypasses.length) failed++;

console.log('\n  ' + (failed ? failed + ' check(s) failed' : 'all checks passed'));
if (failed) process.exit(1);
