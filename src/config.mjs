// looks-clean — exclusions and mutes.
//
// TWO DIFFERENT THINGS, deliberately kept apart:
//
//   exclude — what NOT TO READ. It changes the population, and the population
//             IS the evidence here: excluding the tests can turn a 9-of-11
//             convention into a 3-of-4 coincidence.
//   mute    — what NOT TO SHOW. The site is read and counted towards the
//             population; it simply does not reach the report.
//
// Confusing the two corrupts results silently. A mute implemented as an
// exclusion removes the site from the population and weakens the very rule that
// caught it — and the only visible effect is a smaller number, which reads as
// progress.
//
// A default list is built in, so the tool works with no configuration at all.
// A `.looks-clean.json` in the scanned directory (or one named by --config)
// adds to it; `"exclude"` replaces the defaults only when
// `"excludeDefaults": false` is given.
import fs from 'node:fs';
import path from 'node:path';
import { t } from './lang.mjs';
import { valueOf } from './args.mjs';

// TEST CODE IS NOT A LAYER, AND THAT IS WHY IT IS EXCLUDED BY DEFAULT.
//
// This tool reports a site because its NEIGHBOURS, doing the same job at the
// same level, do it differently. A test file has no such neighbours: the shape
// of each test is dictated by what that test is testing. `got('prime')` has no
// deadline because the test is about the deadline on the NEXT call; a fixture
// under `tests/fixtures/` is malformed on purpose, because being malformed is
// its job.
//
// The cost of not knowing that was measured before this line was written: of the
// thirty findings read by hand in test/precision.json, twelve were test code,
// and 350 of got's 359 findings were under `test/`. See "How often it is wrong"
// in the README — the measurement that motivated this exclusion is printed there
// beside the one taken after it.
//
// WHAT THIS COSTS. Two of this project's own known answers live in
// odd-one-out's `test/` directory, and a default run no longer reaches them.
// test/known-answers.mjs therefore pins a config that reads test code, and says
// so. That is the honest price of the correction, recorded rather than hidden.
//
// The four spellings are one decision: a directory called `test`, `tests` or
// `spec`, the `__tests__` convention, and tests co-located as `*.test.js` or
// `*.spec.ts` beside the code they cover.
export const DEFAULT_EXCLUDE = [
  '**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**',
  '**/out/**', '**/coverage/**', '**/.next/**', '**/.nuxt/**',
  '**/vendor/**', '**/generated/**',
  '**/*.min.js', '**/*.bundle.js', '**/*.map',
  '**/test/**', '**/tests/**', '**/spec/**', '**/__tests__/**',
  '**/*.test.*', '**/*.spec.*',
];

export const CONFIG_NAME = '.looks-clean.json';

// A minimal pattern matcher: ** (any run of segments), * (within one segment).
// Deliberately no library — this is a dozen lines, and every dependency in a
// tool meant to survive `npm i -g` has a cost.
const META = '.+^${}()|[]\\';
function toRegExp(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        i++;
        if (pattern[i + 1] === '/') { i++; out += '(?:.*/)?'; }
        else out += '.*';
      } else {
        out += '[^/]*';
      }
    } else if (META.includes(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
  }
  return new RegExp('^' + out + '$');
}

export function loadConfig(argv = [], root = process.cwd()) {
  const explicit = valueOf(argv, 'config');

  // THIS CATCH USED TO SWALLOW, AND THE TOOL FOUND IT IN ITSELF.
  //
  // It stood as `catch { /* the directory may not exist */ }`. A missing
  // directory really is ordinary here — but so is a directory that exists and
  // cannot be listed, and that arrives through the same catch. The result was
  // "no configuration file", which changes the exclusion list, which changes
  // every population in the run, which changes every finding. The only trace
  // would have been a different number of findings.
  //
  // Reported by `npm run self-check` as rule 1 against the neighbour fourteen
  // lines below, which does say something when a config will not parse.
  let file = explicit;
  const lookupProblems = [];
  if (!file) {
    for (const dir of [root, process.cwd()]) {
      try {
        const p = path.join(dir, CONFIG_NAME);
        if (fs.existsSync(p)) { file = p; break; }
      } catch (e) {
        if (e.code !== 'ENOENT') lookupProblems.push(String(dir) + ' (' + (e.code || e.message) + ')');
      }
    }
  }
  if (!file && lookupProblems.length) {
    console.error(t('configLookupFailed', lookupProblems.join(', ')));
    console.error(t('configFallback'));
  }

  let raw = {};
  if (file) {
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      // SAID OUT LOUD. A config that cannot be parsed used to mean "no
      // exclusions", which changes every population in the run — and the only
      // trace was a different number of findings.
      console.error(t('configUnreadable', file, e.message));
      console.error(t('configFallback'));
      // looks-clean: ok — announced on the two lines above, and the run header then reads "(defaults)"
      raw = {};
      file = null;
    }
  }

  const useDefaults = raw.excludeDefaults !== false;
  const exclude = [...(useDefaults ? DEFAULT_EXCLUDE : []), ...(raw.exclude || [])];
  const regexes = exclude.map(toRegExp);

  const mute = new Map();
  for (const m of raw.mute || []) {
    if (typeof m === 'string') mute.set(m, '');
    else if (m && m.id) mute.set(m.id, m.reason || '');
  }

  const norm = p => String(p).replace(/\\/g, '/');
  const fileLinesCache = new Map();

  return {
    file,
    exclude,
    mute,
    /** whether to skip this path while READING */
    isExcluded(p) {
      const s = norm(p);
      return regexes.some(r => r.test(s));
    },
    /**
     * WHICH pattern skipped this path, or null.
     *
     * A boolean is enough to do the skipping and not enough to explain it. A
     * run that reads eleven files of a three-hundred-file project has to be
     * able to name the rule that removed the rest — see the `notRead` report in
     * src/collect.mjs, and the measurement in test/precision.json that made it
     * necessary.
     */
    excludedBy(p) {
      const s = norm(p);
      const i = regexes.findIndex(r => r.test(s));
      return i < 0 ? null : exclude[i];
    },
    /** whether a finding with this id is hidden IN THE REPORT (the population stays) */
    isMuted(id) { return mute.has(id); },
    /**
     * Muting with a COMMENT in the code: `// looks-clean: ok — reason`.
     *
     * A mute file is good for bulk decisions, but it forces a jump between the
     * code and the configuration and records a fingerprint that cannot be read
     * in place. A comment stands where the decision was made and travels with
     * the code through moves and merges.
     *
     * Both shapes are natural, so both are read — the finding's own line and
     * the line above it.
     */
    mutedByComment(absFile, line) {
      if (!absFile || !line) return null;
      let lines = fileLinesCache.get(absFile);
      if (lines === undefined) {
        // looks-clean: ok — an unreadable file yields no mute, so the finding is shown rather than hidden
        try { lines = fs.readFileSync(absFile, 'utf8').split(/\r?\n/); }
        catch { lines = null; }
        fileLinesCache.set(absFile, lines);
      }
      if (!lines) return null;
      // THE WINDOW IS THREE LINES, NOT TWO, AND THAT WAS MEASURED HERE.
      //
      // A finding on a `catch` is reported at the catch clause, but a person
      // writing the mute puts it above the `try` — which, for the ordinary
      //     try { ... }
      //     catch { ... }
      // shape, is three lines up, not two. With a two-line window the mute
      // simply had no effect and nothing said why: the finding came back
      // unchanged and the reader was left to conclude the feature was broken.
      // Verified on this project's own source, where two of four mutes missed.
      for (const nr of [line - 1, line - 2, line - 3]) {
        const content = lines[nr];
        if (!content) continue;
        const m = content.match(/looks-clean:\s*ok\b[ \t]*[—:-]?[ \t]*(.*)$/i);
        if (m) return (m[1] || '').replace(/\s*(\*\/|-->)\s*$/, '').trim() || t('noReason');
      }
      return null;
    },
    muteReason(id) { return mute.get(id) || ''; },
    describe() {
      return t('exclusions', exclude.length) +
        (this.file ? ' (config: ' + norm(this.file) + ')' : t('defaults')) +
        (mute.size ? t('mutes', mute.size) : '');
    },
  };
}
