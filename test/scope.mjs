// looks-clean — does every sentence about what this tool reads name the same set?
//
// WHY THIS LAYER EXISTS. The help screen carried two strings about the same
// thing: the command's HEADER (`arg: '<js-or-ts-dir>'`) and the line directly
// under it ("Scan a JavaScript, TypeScript or Java tree"). Nothing put them
// side by side. lang-check asked whether each string had gone through the
// dictionary — both had. readme.mjs compares EXAMPLES against a fresh run —
// it does not touch command headers. So two gates stood green over a
// contradiction, the scope of the languages drifted apart exactly where nobody
// was looking, and it shipped to the npm registry that way.
//
// THE FIX FOR THE TYPO WAS NOT THE FIX FOR THE GAP. The header was corrected
// in 0.2.1 and src/languages.mjs made the list of languages a single fact in
// 0.3.1, so every string is now DERIVED and none of them can disagree by hand.
// That is the right repair and it protects only the strings that exist today.
// The next sentence somebody types about what this tool reads will be typed by
// hand, the way all six of the old ones were, and nothing would notice.
//
// SO THIS ASKS THE QUESTION THE OTHER WAY ROUND. It does not compare two
// strings with each other: it compares every string with the CODE. LANGUAGES
// in src/languages.mjs is what the collector matches on, so it is a fact; a
// sentence naming languages is a claim about that fact. Where a claim is
// narrower than the fact, the claim is wrong — no matter which of the two
// somebody edited last.
//
// WHAT COUNTS AS A CLAIM, and this is the part that needed measuring rather
// than guessing. A paragraph naming TWO OR MORE of the languages alongside a
// word about reading — reads, scans, tree, project, files — is claiming scope.
// A paragraph naming one of them is talking about that language; "Dart does not
// repeat Java's pattern" is a finding, not a promise. Measured over both pages
// and the rendered help before this layer was written: seven units matched, six
// of them were real scope claims and complete, and one — the explanation of why
// rule 3 needs a mixed population — names two languages while promising
// nothing. That one carries a marker, and the marker is printed on every run,
// because a silent exception is how the first defect survived.
//
// THE HELP IS READ AS IT IS RENDERED, in both languages, not out of the
// dictionary. The defect was in what a person saw on screen.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGUAGES } from '../src/languages.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CLI = path.join(ROOT, 'bin', 'looks-clean.mjs');

const NAMES = LANGUAGES.map(l => l.name);

// Words that turn "these languages are mentioned" into "these languages are
// what I read". Both message languages, because the help is printed in both.
const SCOPE_WORDS = /\b(reads?|scans?|scanning|tree|project|sources?|files?|supports?|czyta|czytane|skanuj\w*|drzew\w+|projekt\w*|plik\w+)\b/i;

const MARKER = /<!--\s*lc:scope-ok\s+reason="([^"]+)"\s*-->/;

// "JavaScript" CONTAINS "Java". The longer name is matched first and its span
// blanked out, or every mention of JavaScript would count as a mention of Java
// and this layer would pass over exactly the pair it was written for.
function named(text) {
  let t = text;
  const found = new Set();
  for (const n of [...NAMES].sort((a, b) => b.length - a.length)) {
    const re = new RegExp('\\b' + n + '\\b', 'g');
    if (re.test(t)) { found.add(n); t = t.replace(re, ' '.repeat(n.length)); }
  }
  return found;
}

// A unit is a paragraph: consecutive non-blank lines. A sentence split over two
// lines is one claim, and reading line by line reported four complete
// statements as incomplete halves.
function units(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let buf = null, start = 0;
  const flush = () => { if (buf) out.push({ line: start, text: buf.join(' ') }); buf = null; };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // A table row and a heading stand alone; a blank line ends a paragraph.
    if (!l.trim() || /^\s*\|/.test(l) || /^#{1,6} /.test(l)) {
      flush();
      if (l.trim()) out.push({ line: i + 1, text: l });
      continue;
    }
    if (!buf) { buf = []; start = i + 1; }
    buf.push(l);
  }
  flush();
  return out;
}

const problems = [];
const skipped = [];
let claims = 0;

function inspect(where, text, markerNear) {
  for (const u of units(text)) {
    const found = named(u.text);
    if (found.size < 2 || !SCOPE_WORDS.test(u.text)) continue;

    const marked = markerNear ? markerNear(u) : null;
    const missing = NAMES.filter(n => !found.has(n));

    if (marked) {
      skipped.push({ where: where + ':' + u.line, reason: marked, text: u.text.trim().slice(0, 60) });
      continue;
    }
    if (missing.length) {
      problems.push({
        where: where + ':' + u.line,
        missing,
        text: u.text.trim().slice(0, 96),
      });
      continue;
    }
    claims++;
  }
}

console.log('looks-clean — what the help says it reads, against what it reads\n');
console.log('  the fact (src/languages.mjs): ' + NAMES.join(', '));
console.log('');

// ---------------------------------------------------------------- the pages
for (const page of ['README.md', 'README.pl.md']) {
  const raw = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const lines = raw.split(/\r?\n/);
  // The marker is read from the four lines above the paragraph, which is where
  // an HTML comment sits in a markdown file.
  const markerNear = (u) => {
    const near = lines.slice(Math.max(0, u.line - 5), u.line - 1).join('\n');
    const m = MARKER.exec(near);
    return m ? m[1] : null;
  };
  inspect(page, raw, markerNear);
}

// ---------------------------------------------------------------- the help
// AS A PERSON SEES IT. Reading the dictionary instead would check the parts
// and miss the screen, and the screen is where the two strings contradicted
// each other.
for (const lang of ['en', 'pl']) {
  const r = spawnSync(process.execPath, [CLI, '--help', '--lang', lang],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1e9 });
  const out = (r.stdout || '') + (r.stderr || '');
  if (!out.trim()) {
    problems.push({ where: 'help --lang ' + lang, missing: NAMES, text: '(the help printed nothing)' });
    continue;
  }
  inspect('help --lang ' + lang, out, null);
}

// ---------------------------------------------------------------- the report
if (skipped.length) {
  console.log('  marked as not a scope claim:');
  for (const s of skipped) console.log('    ' + s.where + '  ' + s.reason + '\n      "' + s.text + '..."');
  console.log('');
}

if (!problems.length) {
  console.log('  ' + claims + ' scope claims, every one of them naming all ' +
    NAMES.length + ' languages');
  process.exit(0);
}

for (const p of problems) {
  console.log('  FAIL  ' + p.where + '   does not name: ' + p.missing.join(', '));
  console.log('        "' + p.text + '"');
}
console.log('');
console.log('  A sentence about what this tool reads is a claim about');
console.log('  src/languages.mjs. Where the claim is narrower than the code, the');
console.log('  claim is what is wrong — that is how <js-or-ts-dir> reached npm');
console.log('  over a build that had read Java since the release before it.');
console.log('');
console.log('  If the paragraph names languages without promising scope, mark it:');
console.log('    <!-- lc:scope-ok reason="..." -->');
process.exit(1);
