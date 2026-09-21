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
import { TABLE, KEYS, t } from '../src/lang.mjs';
import { LANGUAGES, SOURCE_EXTENSIONS, PAGE_EXTENSIONS, extensionsSpaced, pagesSpaced, languagesJoined }
  from '../src/languages.mjs';

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

// ---------------------------------------------------------------- 4
//
// THE CODE ITSELF IS IN ONE LANGUAGE, AND IT IS ENGLISH.
//
// This tool was written by a Polish speaker, and the layers it was built from
// arrived with Polish identifiers in them: `nowe`, `zniklo`, `zmienione`,
// `bezZmian`, `powod`. They worked perfectly and were invisible to every test —
// right up until somebody who does not read Polish opens `diffSnapshots` and
// finds four of its five local variables unreadable.
//
// The dictionary is the one exception, because Polish sentences are its
// content. Everywhere else — identifiers, comments, file names — English.
{
  const DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
  const POLISH_WORDS = /\b(nowe|zniklo|zmienione|bezZmian|zmiany|powod|poprzedni|biezacy|grupy|pominiete|wiek|stabilnosc|konwencja|populacja|rzadkosc|plik|katalog|sciezka|wynik|blad|czysto)\b/;
  const offenders = [];
  for (const f of SOURCES) {
    if (f === path.join(REPO, 'src', 'lang.mjs')) continue;
    const rel = path.relative(REPO, f).replace(/\\/g, '/');
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (DIACRITICS.test(line) || POLISH_WORDS.test(line))
        offenders.push(rel + ':' + (i + 1) + '  ' + line.trim().slice(0, 60));
    });
  }
  console.log('  ' + (offenders.length ? 'FAIL  ' : 'PASS  ') +
    'the code is in English outside the dictionary');
  for (const o of offenders.slice(0, 8)) console.log('        ' + o);
  if (offenders.length) failed++;
}

// The file names too. A `zapis.mjs` beside a `snapshot.mjs` is the same problem
// one level up, and no amount of English inside it helps.
{
  const bad = SOURCES.map(f => path.basename(f))
    .filter(n => /[ąćęłńóśźż]/i.test(n) ||
      /^(zapis|odczyt|reguly|jezyk|wynik|warstwa)\./.test(n));
  console.log('  ' + (bad.length ? 'FAIL  ' : 'PASS  ') + 'the file names are in English');
  for (const b of bad) console.log('        ' + b);
  if (bad.length) failed++;
}

// ---------------------------------------------------------------- 6
//
// WHICH LANGUAGES THIS BUILD READS IS A FACT, AND EVERY SENTENCE ABOUT IT IS A
// CLAIM. The fact is src/languages.mjs. The claims were written out by hand in
// six places, and counting them found five that had drifted: both pages still
// offered "JavaScript, TypeScript or Java" after Dart landed, a known answer
// explained itself with a list two languages old, a resilience scenario waited
// for a phrase that could no longer be printed, and the sentence naming every
// readable extension had been missing `.cts` since before any of that.
//
// None of them broke anything. Each of them told a reader a set that was not
// the set — which is the defect this tool reports in other people's code.
//
// So two things are checked here, in both directions:
//   1. the dictionary names no language and no source extension of its own
//   2. what a person actually reads names every one of them
{
  const check = (name, ok, detail) => {
    if (!ok) failed++;
    console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + name.padEnd(52) + (detail || ''));
  };

  // A mention that is NOT a claim about what this build reads. Each one is
  // listed with its reason, because an exemption without a reason is how a
  // check like this quietly stops checking.
  const EXEMPT = [
    ['diffNeedsTwo', '.json', 'a snapshot the command takes, not a language it reads'],
    ['configLookupFailed', '.json', 'the configuration file, named so it can be looked for'],
    ['helpHowToRun', '.mjs', "this tool's own entry point, not a claim about sources"],
    ['r1Alone', 'Dart', 'the Dart ANALYZER, named beside eslint and C# as a linter that already finds the empty case'],
  ];

  const EXT = /\.[a-z]{1,5}\b/g;
  const NAMES = ['JavaScript', 'TypeScript', 'Java', 'Dart', 'Python', 'Go', 'Ruby', 'Kotlin', 'Swift', 'PHP'];
  const allowedExt = new Set([...SOURCE_EXTENSIONS, ...PAGE_EXTENSIONS].map(e => '.' + e));
  const exempt = (key, token) => EXEMPT.some(e => e[0] === key && e[1] === token);

  const strays = [];
  for (const k of KEYS) {
    for (const lang of ['en', 'pl']) {
      const text = String(TABLE[k][lang] || '');
      for (const m of text.matchAll(EXT)) {
        const tok = m[0].toLowerCase();
        if (!allowedExt.has(tok)) continue;   // only the ones this build claims to read
        if (exempt(k, m[0])) continue;
        strays.push(k + ' [' + lang + '] ' + m[0]);
      }
      for (const nm of NAMES) {
        if (!new RegExp('\\b' + nm + '\\b').test(text)) continue;
        if (exempt(k, nm)) continue;
        strays.push(k + ' [' + lang + '] ' + nm);
      }
    }
  }
  check('the dictionary names no language of its own', strays.length === 0,
    strays.length ? strays.slice(0, 4).join('; ') : KEYS.length + ' keys, ' + EXEMPT.length + ' stated exemptions');

  // Every exemption must still be reachable. One left behind after its string
  // was rewritten is a licence nobody is using and nobody will notice.
  const dead = EXEMPT.filter(([key, token]) =>
    !TABLE[key] || !['en', 'pl'].some(l => String(TABLE[key][l] || '').includes(token)));
  check('every exemption is still in use', dead.length === 0,
    dead.length ? dead.map(d => d[0] + '/' + d[1]).join(', ') : EXEMPT.length + ' in use');

  // AND THE OTHER DIRECTION. The dictionary being clean proves only that the
  // list is not written twice; it does not prove a reader is ever told it.
  const help = t('cmdScan', languagesJoined(t('listConjunction')));
  const unnamed = LANGUAGES.map(l => l.name).filter(n => !help.includes(n));
  check('the help names every language that is read', unnamed.length === 0,
    unnamed.length ? 'missing: ' + unnamed.join(', ') : LANGUAGES.length + ' languages');

  // THE FIRST SENTENCE ANYBODY READS IS NOT IN THIS REPOSITORY'S VOICE AT ALL.
  // It is the package description, which npm prints above everything else, and
  // it said "JavaScript, TypeScript and Java" for a release after Dart shipped.
  // The keyword list had the same hole.
  //
  // These cannot be BUILT from the list the way a message can: package.json is
  // data npm reads, not code this tool runs. So they are checked instead, which
  // is the weaker of the two and the only one available — and being the weaker
  // one is exactly why it is worth having.
  {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    const names = LANGUAGES.map(l => l.name);

    // `Java` sits inside `JavaScript`. A plain substring test passed a
    // description that had dropped Java and kept JavaScript, and printed
    // `PASS  4 languages` while naming three. A check that cannot go red is
    // worse than no check: it is the empty result this tool exists to find.
    const LETTER = c => c !== undefined && /[A-Za-z]/.test(c);
    const namesIt = (text, name) => {
      for (let at = text.indexOf(name); at !== -1; at = text.indexOf(name, at + 1))
        if (!LETTER(text[at - 1]) && !LETTER(text[at + name.length])) return true;
      return false;
    };

    const absent = names.filter(nm => !namesIt(pkg.description, nm));
    check('the package description names every language', absent.length === 0,
      absent.length ? 'missing: ' + absent.join(', ') : names.length + ' languages');

    const kw = (pkg.keywords || []).map(k => k.toLowerCase());
    const unkeyed = names.filter(nm => !kw.includes(nm.toLowerCase()));
    check('the keywords name every language', unkeyed.length === 0,
      unkeyed.length ? 'missing: ' + unkeyed.join(', ') : names.length + ' keywords');

    // THE DESCRIPTION IS READ BY A STRANGER. npm prints it to someone who has
    // never heard of this project and does not read Polish. A sibling tool
    // shipped a release whose whole description was Polish without diacritics
    // — `Porownuje migracje SQL ... Tylko odczyt.` — and nothing said a word,
    // because a check for ąćęłńóśźż would have let that sentence through.
    //
    // This is a smoke alarm, not a language detector. It carries the function
    // words no Polish sentence of this length avoids, plus the ones that
    // actually shipped. Add to it rather than making it clever.
    const POLISH = ['nie', 'jest', 'sie', 'tego', 'tym', 'tych', 'ktore', 'ktora', 'ktory',
      'oraz', 'przez', 'dla', 'jako', 'tylko', 'bez', 'gdy', 'czy', 'juz', 'moze', 'musi',
      'wszystkie', 'porownuje', 'wypisuje', 'sprawdza', 'zwraca', 'odczyt', 'plik', 'pliku',
      'kod', 'kodu', 'baza', 'bazy', 'migracje', 'miejsca', 'narzedzie', 'rozjazdy'];
    const DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
    const descWords = (pkg.description.match(/[A-Za-z]{3,}/g) || []).map(w => w.toLowerCase());
    const leaked = [...new Set(descWords.filter(w => POLISH.includes(w)))];
    const diacritic = pkg.description.match(DIACRITICS);
    check('the description is in English', leaked.length === 0 && !diacritic,
      diacritic ? 'Polish letter: ' + diacritic[0]
        : leaked.length ? 'Polish: ' + leaked.join(', ')
        : descWords.length + ' words, none Polish');

    // Keyword hygiene. npm lowercases nothing and de-duplicates nothing; a
    // keyword with a capital in it is simply a keyword nobody reaches.
    const raw = pkg.keywords || [];
    const cased = raw.filter(k => k !== k.toLowerCase());
    const dupes = [...new Set(kw.filter((k, i) => kw.indexOf(k) !== i))];
    check('the keywords are usable', raw.length > 0 && cased.length === 0 && dupes.length === 0,
      !raw.length ? 'no keywords at all'
        : cased.length ? 'not lowercase: ' + cased.join(', ')
        : dupes.length ? 'duplicated: ' + dupes.join(', ')
        : raw.length + ' keywords, lowercase, distinct');
  }

  const hint = t('noSourcesHint', extensionsSpaced(), pagesSpaced());
  const unlisted = [...SOURCE_EXTENSIONS, ...PAGE_EXTENSIONS].filter(e => !hint.includes('.' + e));
  check('the "nothing to read" sentence names every extension', unlisted.length === 0,
    unlisted.length ? 'missing: ' + unlisted.join(', ')
      : SOURCE_EXTENSIONS.length + ' sources and ' + PAGE_EXTENSIONS.length + ' page types');
}

console.log('\n  ' + (failed ? failed + ' check(s) failed' : 'all checks passed'));
if (failed) process.exit(1);
