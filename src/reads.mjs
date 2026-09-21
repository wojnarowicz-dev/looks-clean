// looks-clean — what counts as a read, and what counts as a time limit on one.
//
// A "read" here is any call that can fail for reasons OUTSIDE this program: the
// network, a database, the file system, a subprocess, or data somebody else
// wrote. That boundary is the whole point. A failure inside the program is a
// bug and shows up as a stack trace; a failure at the boundary is ordinary,
// expected, and is precisely the one that gets dressed up as an empty result.
//
// THE FAMILY, NOT THE CALL, IS THE UNIT OF COMPARISON. Rule 3 asks "do the
// reads of the same kind in this layer have a time limit". `fetch` and
// `supabase.rpc` are not the same kind: a project may reasonably put a deadline
// on one and rely on the client's own for the other. Two `supabase.rpc` calls in
// one file, one with a deadline and one without, is a real inconsistency.
// Grouping too finely (by exact callee text) would leave every group with one
// member and the rule would find nothing while saying nothing — the failure
// mode this tool is named after.
//
// THE TABLE IS PER LANGUAGE, THE FAMILY NAMES ARE NOT. `fs` means the same kind
// of work in both languages, so a finding reads the same way whichever file it
// came from; but `readFileSync` and `Files.readString` are matched only against
// the language that can contain them. One table for both would let a Java
// spelling claim a JavaScript call, and a wrong match here is not a cosmetic
// error: a false read joins a population and shifts the conventionality of every
// real finding in the same group.

// The words a supabase chain is built from, and the operations it ends on.
// BOTH HALVES ARE NEEDED, and each half was got wrong once:
//   * requiring only the ending  -> `list.remove(i)` became a database read
//   * requiring only a chain word -> `Array.from(x)` became one
//   * looking for the chain word only BEFORE the last segment -> `sb.rpc('x')`
//     stopped being one, because there `rpc` is both the chain word and the
//     operation. That regression is why `sb.rpc` and `sb.from.select` both have
//     rows in test/vocabulary.mjs: the alias `sb` is the spelling in the real
//     material, and the version that broke passed every example named
//     `supabase.*`.
const SUPABASE_CHAIN = new Set(['from', 'rpc', 'storage', 'auth', 'functions', 'realtime', 'channel']);
const SUPABASE_TAIL = /^(select|insert|update|upsert|delete|rpc|download|upload|remove|list|signIn\w*|signUp|signOut|getUser|getSession|refreshSession|invoke)$/;

const JS_FAMILIES = [
  ['net', /^(fetch|axios|got|ky|superagent|request)$|^(axios|got|ky|http|https)\.(get|post|put|patch|delete|head|request)$|\.(fetch)$|XMLHttpRequest/],
  // `.find(` and `.filter(` are NOT here, and that is a correction rather than
  // an omission. With `\.find$` in the pattern, `data.users.find(u => ...)` —
  // Array.prototype.find over an array already in memory — was reported as a
  // database read with no time limit, in two files. A false read is worse than
  // a missed one here: it joins a population and shifts the conventionality of
  // every real finding in the same group.
  ['db', /\.(query|execute|findOne|findMany|findFirst|findUnique|aggregate|countDocuments|insertOne|updateOne|deleteOne|createQueryBuilder|getMany|getOne)$|^(knex|prisma|pool|db|client|conn|connection)\./],
  ['proc', /^(exec|execSync|execFile|execFileSync|spawn|spawnSync|fork)$|^child_process\./],
  ['fs', /^(readFile|readFileSync|writeFile|writeFileSync|readdir|readdirSync|stat|statSync|lstat|access|accessSync|realpath|copyFile|rename|rm|rmSync|unlink|mkdir)$|^fs(\.promises)?\.|^fsp\./],
  ['parse', /^JSON\.parse$|^(parseXml|parseYaml|YAML\.parse|TOML\.parse)$/],
  ['storage', /^(localStorage|sessionStorage)\.(getItem|setItem|removeItem)$|^(indexedDB|caches)\./],
  ['dynamic-import', /^import$/],
];

// JAVA: JDK ONLY, AND WRITTEN FROM A COUNT RATHER THAN FROM MEMORY.
//
// Every pattern below was chosen after counting what a real 117-file Java tree
// actually calls: `Files.*` 459 times, `.send` 16 (every one of them
// `HttpClient.send`), `.waitFor` 6. Three shapes that a table written from
// memory would have carried were left OUT because the count found nothing for
// them to match, and a row that matches nothing is invisible to every other
// test layer while still making the vocabulary look complete:
//
//   * db    — 0 JDBC calls in the material. No `executeQuery`, no
//             `getConnection`. A `db` row for Java would be a dead row.
//   * parse — the only `.parse` calls were `Instant.parse` and
//             `LocalDateTime.parse`, which read a string this program already
//             holds. That is not an external read, and JSON in Java arrives
//             through libraries that are not the JDK.
//   * Runtime.getRuntime.exec — present in the table because it is the
//             idiomatic spelling, but the material calls `Runtime.getRuntime()`
//             only for `maxMemory` and `availableProcessors`, which are JVM
//             statistics and not reads. The pattern is anchored to `.exec` so
//             those cannot match.
//
// PROJECT WRAPPERS ARE NOT IN HERE EITHER. The tree this was measured against
// routes much of its IO through a `SafeIo` helper, and adding it would have
// been fitting the tool to one codebase in order to pass one test. The cost is
// stated rather than hidden: handlers standing over a project's own IO wrapper
// have no family, so they join no population and are neither reported nor
// counted as well-behaved neighbours.
const JAVA_FAMILIES = [
  ['net', /^(HttpClient|HttpRequest)\.|\.(send|sendAsync|openConnection|openStream)$/],
  ['proc', /\.waitFor$|^Runtime\.getRuntime\.exec$/],
  ['fs', /^Files\.|^new(FileInputStream|FileOutputStream|FileReader|FileWriter|RandomAccessFile)$/],
];

const FAMILIES = { js: JS_FAMILIES, java: JAVA_FAMILIES };

/**
 * The family of a call, or null when the call is not a read.
 *
 * @param calleeText the callee, as the language's vocabulary spells it
 * @param chainHead  the head of the call chain
 * @param lang       which table to use — the `name` of a src/syntax/ module
 *
 * SUPABASE IS MATCHED BY THE SHAPE OF THE CHAIN, not by the name at its head.
 *
 * The first version required the head to be called something containing
 * "supabase", or the callee to END on a chain word. Both were wrong for the
 * commonest spelling there is: `sb.from('review_credits').select('reviews_left')`
 * has a head called `sb` and ends on `select`, so it matched neither and was
 * not a read at all. In the file this tool was built against, that silently
 * removed table reads from the supabase population while leaving the `sb.rpc`
 * ones in — a smaller population, weaker evidence behind every finding in it,
 * and nothing anywhere saying so.
 *
 * The shape is what identifies it: the chain passes through `from`, `rpc`,
 * `storage`, `auth`, `functions`, `realtime` or `channel`, and ends on an
 * operation. `Array.from(x)` passes through `from` and ends there, so it is
 * not one; `list.remove(i)` ends on an operation without passing through
 * anything, so neither is it.
 */
export function familyOf(calleeText, chainHead, lang) {
  const table = FAMILIES[lang];
  // NO DEFAULT LANGUAGE. A table picked by fallback would read one language's
  // source through another's spellings and answer "not a read" to nearly
  // everything — a full population quietly missing, which is the one answer
  // this tool must never give by accident.
  if (!table) throw new Error('familyOf: no read table for language ' + JSON.stringify(lang));

  const callee = String(calleeText || '').replace(/\s+/g, '');
  if (!callee) return null;

  if (lang === 'js') {
    const segments = callee.split('.');
    const tail = segments[segments.length - 1];
    if (SUPABASE_TAIL.test(tail) &&
      (segments.some(s => SUPABASE_CHAIN.has(s)) || /supabase/i.test(String(chainHead || ''))))
      return 'supabase';
  }

  for (const [name, re] of table) if (re.test(callee)) return name;
  return null;
}

// ------------------------------------------------------------------ time limits

/**
 * Anything that puts a deadline on an operation. Matched against the text of the
 * statement the read sits in, after whitespace is squeezed out.
 *
 * WHY THE WHOLE STATEMENT AND NOT THE CALL. The commonest shape in real code is
 * not an option on the call itself:
 *
 *     const ctrl = new AbortController();
 *     setTimeout(() => ctrl.abort(), 5000);
 *     const r = await fetch(url, { signal: ctrl.signal });
 *
 * The deadline lives three statements away. What the READ carries is the
 * signal — so the signal is what is looked for. This deliberately counts a
 * signal handed in from elsewhere as guarded, even when nothing ever fires it:
 * the tool under-reports rather than accusing a caller it cannot see.
 *
 * ONE LIST FOR BOTH LANGUAGES, unlike the read families above. A deadline is
 * spelled in prose that does not collide across languages — nothing in
 * JavaScript writes `setReadTimeout(`, nothing in Java writes `AbortSignal` —
 * and `.timeout(` happens to be the right answer in both.
 */
const TIMEOUT_MARKERS = [
  ['AbortSignal.timeout', /AbortSignal\.timeout\s*\(/],
  ['signal', /\bsignal\s*[:,)]|\bsignal\s*\}/],
  ['AbortController', /\bAbortController\b/],
  ['timeout option', /\btimeout(Ms|MS|Millis|Seconds)?\s*:/],
  ['.timeout()', /\.timeout\s*\(/],
  ['Promise.race', /Promise\s*\.\s*race\s*\(/],
  ['withTimeout()', /\b(withTimeout|withDeadline|timeLimited|timeoutAfter|raceTimeout)\s*\(/],
  ['deadline', /\b(deadline|abortAfter|maxWait|maxWaitMs)\b/],
  // Java. `.timeout(Duration.ofSeconds(5))` on an HttpRequest is already caught
  // by `.timeout()` above, which is why it is not repeated here.
  ['connectTimeout()', /\.connectTimeout\s*\(/],
  ['setConnectTimeout()/setReadTimeout()', /\bset(Connect|Read)Timeout\s*\(/],
  ['orTimeout()', /\b(orTimeout|completeOnTimeout)\s*\(/],
  ['TimeUnit', /\bTimeUnit\.\w+/],
];

/**
 * @returns the name of the marker found, or null.
 * The NAME is returned rather than a boolean because the report tells the
 * reader what the neighbours already use — "give it the same limit the
 * neighbours use: AbortSignal.timeout" is actionable; "add a timeout" is not.
 */
export function timeoutMarker(statementText) {
  const s = String(statementText || '').replace(/\s+/g, ' ');
  for (const [name, re] of TIMEOUT_MARKERS) if (re.test(s)) return name;
  return null;
}

export const FAMILY_NAMES = ['supabase', 'net', 'db', 'proc', 'fs', 'parse', 'storage', 'dynamic-import'];

/**
 * The families each language's table can actually produce, derived from the
 * tables themselves so that adding a row obliges somebody to add an example.
 * A row nothing exercises is invisible to every other layer: the family exists,
 * it is never populated, the population is smaller, fewer findings come out —
 * and a smaller number reads as cleaner code.
 */
export const FAMILY_NAMES_BY_LANG = {
  js: ['supabase', ...new Set(JS_FAMILIES.map(([name]) => name))],
  java: [...new Set(JAVA_FAMILIES.map(([name]) => name))],
};

/** Every marker name, so the vocabulary layer can insist each one has an example. */
export const TIMEOUT_MARKER_NAMES = TIMEOUT_MARKERS.map(([name]) => name);
