// looks-clean — layer 1: the tool's vocabulary is coherent.
//
// WHAT THIS ADDS THAT NOTHING ELSE DOES. Three tables decide everything the
// rules can see:
//
//   src/reads.mjs   which calls are reads, and grouped into which family
//   src/reads.mjs   what counts as a deadline on one
//   src/values.mjs  which answers are ambiguous, and which name their outcome
//
// Every other layer measures the tool through a scan, and a scan can only
// disagree with a recording. A table entry that matches nothing at all is
// invisible to all of them: the family exists, the family is never populated,
// the population is smaller, fewer findings come out — and a smaller number
// reads as cleaner code. That is this project's own subject, sitting in its
// dictionary.
//
// So each entry is exercised directly, against an example it must match and an
// example it must not. An entry with no example is a failure here, which is the
// only way to keep a table from quietly growing dead rows.
import { parserFor } from '../src/parser.mjs';
import { familyOf, timeoutMarker, FAMILY_NAMES, FAMILY_NAMES_BY_LANG, TIMEOUT_MARKER_NAMES } from '../src/reads.mjs';
import { classify, normaliseText } from '../src/values.mjs';
import * as JS from '../src/syntax/js.mjs';
import * as JAVA from '../src/syntax/java.mjs';

let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + name.padEnd(54) + (detail || ''));
};

console.log('looks-clean — vocabulary\n');

// ---------------------------------------------------------------- 1. families
//
// Each row: the family, a call that MUST be read as that family, and the head
// of its chain. The second column doubles as documentation — this is the
// shortest honest answer to "what does looks-clean consider a read".
const FAMILY_EXAMPLES = [
  // THE ALIASED SPELLINGS COME FIRST, and they are the reason this block is not
  // decoration. Real code writes `const sb = createClient(...)`, so nothing in
  // the chain says "supabase" at all. A version of familyOf that matched only
  // `supabase.*` looked correct against every example named after the library
  // and quietly dropped every table read in the file this tool was built
  // against.
  ['supabase', 'sb.from.select', 'sb'],
  ['supabase', 'sb.rpc', 'sb'],
  ['supabase', 'client.storage.from.remove', 'client'],
  ['supabase', 'supabase.rpc', 'supabase'],
  ['supabase', 'supabase.storage.from.remove', 'supabase'],
  ['supabase', 'supabase.auth.getUser', 'supabase'],
  ['net', 'fetch', 'fetch'],
  ['net', 'axios.get', 'axios'],
  ['net', 'got.post', 'got'],
  ['db', 'pool.query', 'pool'],
  ['db', 'prisma.user.findMany', 'prisma'],
  ['proc', 'execFileSync', 'execFileSync'],
  ['proc', 'spawnSync', 'spawnSync'],
  ['fs', 'fs.readFileSync', 'fs'],
  ['fs', 'readdirSync', 'readdirSync'],
  ['parse', 'JSON.parse', 'JSON'],
  ['storage', 'localStorage.getItem', 'localStorage'],
  ['dynamic-import', 'import', 'import'],
];

// Calls that must NOT be reads. Every one of these was a false positive at some
// point, or is one waiting to happen — a false read is worse than a missed one,
// because it joins a population and shifts the conventionality of every real
// finding in the same group.
const NOT_READS = [
  // ONE CHAIN IS ONE READ. `sb.from('x').select('y').maybeSingle()` is three
  // nested call expressions, and the walker sees all three. Only the middle one
  // is a read; `.from(...)` is not an operation and `.maybeSingle()` refines an
  // operation already counted. Admitting the refiners — maybeSingle, single,
  // limit, order, eq — would count one query two or three times, inflating
  // every supabase population and weakening every finding inside it.
  ['sb.from.select.maybeSingle', 'sb', 'the same query, one call further out'],
  ['sb.from', 'sb', 'the start of a chain, not an operation'],
  ['data.users.find', 'data', 'Array.prototype.find — reported as a database read in two files'],
  ['items.filter', 'items', 'the same mistake one method along'],
  ['list.map', 'list', 'ditto'],
  ['JSON.stringify', 'JSON', 'the other half of the JSON pair, which cannot fail on outside data'],
  ['Math.max', 'Math', 'arithmetic'],
  ['el.querySelector', 'el', 'the DOM is not an external read'],
  ['String', 'String', 'a bare constructor'],
];

// JAVA, JDK ONLY. The second column is again the documentation: this is the
// shortest honest answer to "what does looks-clean consider a read in Java".
const JAVA_FAMILY_EXAMPLES = [
  ['fs', 'Files.newDirectoryStream', 'Files'],
  ['fs', 'Files.readString', 'Files'],
  ['fs', 'Files.readAttributes', 'Files'],
  ['fs', 'newFileInputStream', 'newFileInputStream'],
  ['net', 'klient.send', 'klient'],
  ['net', 'HttpClient.newBuilder.build', 'HttpClient'],
  ['net', 'url.openStream', 'url'],
  ['proc', 'process.waitFor', 'process'],
  ['proc', 'Runtime.getRuntime.exec', 'Runtime'],
];

// The Java half of "a false read is worse than a missed one". The first two
// rows are the ones that would have done real damage: `Path.of` is the single
// commonest call in the tree this table was measured against (211 times inside
// guarded try blocks alone) and touches no disk, and `Runtime.getRuntime()` is
// called there only for JVM statistics.
const JAVA_NOT_READS = [
  ['Path.of', 'Path', 'path arithmetic, and the commonest call in the material'],
  ['Path.of.normalize.toAbsolutePath', 'Path', 'still no disk at the end of it'],
  ['Runtime.getRuntime.maxMemory', 'Runtime', 'a JVM statistic, not an external read'],
  ['Integer.parseInt', 'Integer', 'a string this program already holds'],
  ['Instant.parse', 'Instant', 'the same, and why Java has no parse family'],
  ['newArrayList', 'newArrayList', 'a constructor that opens nothing'],
  ['list.remove', 'list', 'a collection, not a store'],
  ['SafeIo.readStringUtf8WithRetry', 'SafeIo', 'a project IO wrapper: deliberately absent, see reads.mjs'],
  ['logoFile.exists', 'logoFile', 'java.io.File methods are left out, so this under-reports'],
];

for (const [family, callee, head] of FAMILY_EXAMPLES) {
  const got = familyOf(callee, head, 'js');
  check('js read: ' + callee, got === family, got === family ? family : 'read as ' + got);
}
for (const [callee, head, why] of NOT_READS) {
  const got = familyOf(callee, head, 'js');
  check('js not a read: ' + callee, got === null, got === null ? why.slice(0, 46) : 'read as ' + got);
}
for (const [family, callee, head] of JAVA_FAMILY_EXAMPLES) {
  const got = familyOf(callee, head, 'java');
  check('java read: ' + callee, got === family, got === family ? family : 'read as ' + got);
}
for (const [callee, head, why] of JAVA_NOT_READS) {
  const got = familyOf(callee, head, 'java');
  check('java not a read: ' + callee, got === null, got === null ? why.slice(0, 46) : 'read as ' + got);
}

// A LANGUAGE MUST NOT READ ANOTHER'S SPELLINGS. Two tables under one function
// is the arrangement where this goes wrong quietly, so it is pinned.
check('java spellings are not read as JavaScript',
  familyOf('Files.readString', 'Files', 'js') === null &&
  familyOf('process.waitFor', 'process', 'js') === null, '');
check('javascript spellings are not read as Java',
  familyOf('fs.readFileSync', 'fs', 'java') === null &&
  familyOf('sb.from.select', 'sb', 'java') === null &&
  familyOf('JSON.parse', 'JSON', 'java') === null, '');

// AND NO LANGUAGE BY DEFAULT. A fallback table would read one language through
// another's spellings and answer "not a read" to nearly everything.
{
  let threw = false;
  try { familyOf('fetch', 'fetch', undefined); } catch { threw = true; }
  check('an unknown language is refused, not guessed', threw, '');
}

// Every family each table can produce must be exercised above. A family with no
// example is a row nothing tests.
for (const [lang, names] of Object.entries(FAMILY_NAMES_BY_LANG)) {
  const rows = lang === 'js' ? FAMILY_EXAMPLES : JAVA_FAMILY_EXAMPLES;
  const covered = new Set(rows.map(e => e[0]));
  const unexercised = names.filter(f => !covered.has(f));
  check('every ' + lang + ' family has an example', unexercised.length === 0,
    unexercised.length ? 'unexercised: ' + unexercised.join(', ') : names.length + ' families');
}
check('FAMILY_NAMES covers every table', 
  Object.values(FAMILY_NAMES_BY_LANG).flat().every(f => FAMILY_NAMES.includes(f)),
  FAMILY_NAMES.length + ' names');

// ---------------------------------------------------------------- 2. deadlines
//
// Each row: a statement that MUST be seen as carrying a deadline, and the name
// the tool should give the mechanism. The name matters because the fix names it
// back to the reader — "give it the limit the neighbours use: AbortSignal.timeout"
// is actionable, "add a timeout" is not.
const GUARDED = [
  ['const r = await fetch(u, { signal: AbortSignal.timeout(5000) });', 'AbortSignal.timeout'],
  ['const r = await fetch(u, { signal: ctrl.signal });', 'signal'],
  ['const ctrl = new AbortController();', 'AbortController'],
  ['const r = await axios.get(u, { timeout: 5000 });', 'timeout option'],
  ['const r = await db.query(q).timeout(3000);', '.timeout()'],
  ['const r = await Promise.race([fetch(u), later]);', 'Promise.race'],
  ['const r = await withTimeout(sb.rpc("x"), 5000);', 'withTimeout()'],
  ['const r = await read(u, { deadline: t });', 'deadline'],
  // Java. The mechanisms are different words for the same promise, and the
  // report names the one the neighbours already use.
  ['var c = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();', 'connectTimeout()'],
  ['conn.setReadTimeout(5000);', 'setConnectTimeout()/setReadTimeout()'],
  ['var v = future.orTimeout(5, TimeUnit.SECONDS).join();', 'orTimeout()'],
  ['boolean done = p.waitFor(30, TimeUnit.SECONDS);', 'TimeUnit'],
  ['var res = client.send(req.timeout(Duration.ofSeconds(3)).build(), h);', '.timeout()'],
];

// Statements that must NOT be seen as guarded. `signalHandler` is the one that
// matters: a substring match on "signal" would take it, and every unguarded
// read in a file that happens to mention signals would go quiet.
const UNGUARDED = [
  'const r = await fetch(u);',
  'const r = await fetch(u, { method: "POST" });',
  'const r = await sb.rpc("my_reviews");',
  'signalHandler(u);',
  'const timeoutLabel = "no limit";',
  'String s = Files.readString(Path.of(p));',
  'var res = client.send(req, HttpResponse.BodyHandlers.ofString());',
  'int done = p.waitFor();',
];

for (const [stmt, marker] of GUARDED) {
  const got = timeoutMarker(stmt);
  check('deadline: ' + marker, got === marker, got === marker ? '' : 'seen as ' + JSON.stringify(got));
}
// Same rule as the families: a marker nothing exercises is a row that can stop
// matching without any layer noticing.
{
  const named = new Set(GUARDED.map(g => g[1]));
  const unexercised = TIMEOUT_MARKER_NAMES.filter(m => !named.has(m));
  check('every deadline marker has an example', unexercised.length === 0,
    unexercised.length ? 'unexercised: ' + unexercised.join(', ') : TIMEOUT_MARKER_NAMES.length + ' markers');
}
for (const stmt of UNGUARDED) {
  const got = timeoutMarker(stmt);
  check('no deadline: ' + stmt.slice(0, 40), got === null, got === null ? '' : 'seen as ' + got);
}

// ---------------------------------------------------------------- 3. answers
const parser = await parserFor('vocabulary.ts');
const javaParser = await parserFor('Vocabulary.java');

/** Parses one expression and hands back its node, the way a rule would see it. */
function expression(src) {
  const tree = parser.parse('const x = ' + src + ';');
  let found = null;
  const walk = n => {
    if (!found && n.type === 'variable_declarator') found = n.childForFieldName('value');
    for (let i = 0; i < n.childCount && !found; i++) walk(n.child(i));
  };
  walk(tree.rootNode);
  return found;
}

/** The same, in Java. A return is used because Java has no bare expression file. */
function javaExpression(src) {
  const tree = javaParser.parse('class V { Object m() { return ' + src + '; } }');
  let found = null;
  const walk = n => {
    if (!found && n.type === 'return_statement') found = n.namedChild(0);
    for (let i = 0; i < n.childCount && !found; i++) walk(n.child(i));
  };
  walk(tree.rootNode);
  return found;
}

// Each row: the expression, and the canonical spelling it must reduce to. The
// canonical form is what rule 4 compares across two paths, so `[ ]` and `[]`
// meeting is the whole of that rule working.
const AMBIGUOUS = [
  ['[]', '[]'],
  ['[ ]', '[]'],
  ['{}', '{}'],
  ['null', 'null'],
  ['undefined', 'undefined'],
  ['0', '0'],
  ['false', 'false'],
  ["''", "''"],
  ['""', "''"],
  ['new Map()', 'new Map()'],
  ['new Set()', 'new Set()'],
  ['[] as string[]', '[]'],
  ['([])', '[]'],
  ['(null)', 'null'],
];

const TAGGED = [
  '{ known: false, value: [] }',
  '{ ok: false, error: e }',
  '{ ok: true, rows: [] }',
  '{ status: "failed" }',
  'Err(e)',
  'Result.error(e)',
];

// Answers that are neither: real content, and things a caller can tell apart
// from "none" without being told.
const OTHER = [
  'rows',
  '[1, 2, 3]',
  '{ id: 4, name: "x" }',
  'jsonResponse({ error: "DELETE_FAILED" }, 500)',
  'new Error("nope")',
];

// THE JAVA HALF. The canonical column is what rule 4 compares across two paths,
// so `new ArrayList<>()` meeting `new ArrayList<File>()` is that rule working on
// a language whose type arguments are written on the value.
const JAVA_AMBIGUOUS = [
  ['new ArrayList<>()', 'new ArrayList<>()'],
  ['new ArrayList<File>()', 'new ArrayList<>()'],
  ['new HashMap<>()', 'new HashMap<>()'],
  ['new HashSet<>()', 'new HashSet<>()'],
  ['new LinkedList<>()', 'new LinkedList<>()'],
  ['Collections.emptyList()', 'Collections.emptyList()'],
  ['Collections.emptyMap()', 'Collections.emptyMap()'],
  ['Collections.emptySet()', 'Collections.emptySet()'],
  ['List.of()', 'List.of()'],
  ['Map.of()', 'Map.of()'],
  ['Set.of()', 'Set.of()'],
  ['Optional.empty()', 'Optional.empty()'],
  ['null', 'null'],
  ['false', 'false'],
  ['0', '0'],
  ['""', '""'],
  ['(List<File>) null', 'null'],
];

const JAVA_TAGGED = [
  'new ProjectOpResult.Ok(ref)',
  'ProjectOpResult.failure(msg)',
  'Result.error(e)',
];

// `List.of(a, b)` is the row that matters here: the empty call is ambiguous and
// the same call with contents is not, and only the text tells them apart.
// `INVALID_PATH_ERROR` is the neighbour that makes B7 a deviation rather than a
// habit — an answer a caller is forced to read.
const JAVA_OTHER = [
  'List.of(a, b)',
  'new ArrayList<>(other)',
  'INVALID_PATH_ERROR',
  'new File(path)',
  'rows',
];

for (const [src, canonical] of AMBIGUOUS) {
  const c = classify(expression(src), JS);
  check('js ambiguous: ' + src, c.kind === 'ambiguous' && c.value === canonical,
    c.kind === 'ambiguous' ? 'reduced to ' + c.value : 'classified ' + c.kind);
}
for (const src of TAGGED) {
  const c = classify(expression(src), JS);
  check('js tagged: ' + src.slice(0, 40), c.kind === 'tagged', 'classified ' + c.kind);
}
for (const src of OTHER) {
  const c = classify(expression(src), JS);
  check('js other: ' + src.slice(0, 40), c.kind === 'other', 'classified ' + c.kind);
}
for (const [src, canonical] of JAVA_AMBIGUOUS) {
  const c = classify(javaExpression(src), JAVA);
  check('java ambiguous: ' + src, c.kind === 'ambiguous' && c.value === canonical,
    c.kind === 'ambiguous' ? 'reduced to ' + c.value : 'classified ' + c.kind);
}
for (const src of JAVA_TAGGED) {
  const c = classify(javaExpression(src), JAVA);
  check('java tagged: ' + src.slice(0, 40), c.kind === 'tagged', 'classified ' + c.kind);
}
for (const src of JAVA_OTHER) {
  const c = classify(javaExpression(src), JAVA);
  check('java other: ' + src.slice(0, 40), c.kind === 'other', 'classified ' + c.kind);
}

// Every ambiguous literal each language lists must be exercised above, for the
// same reason a family must be: an entry nothing matches shrinks a population
// without saying so.
for (const [label, syn, rows] of [['js', JS, AMBIGUOUS], ['java', JAVA, JAVA_AMBIGUOUS]]) {
  const reached = new Set(rows.map(r => r[1]));
  const unexercised = [...new Set(syn.AMBIGUOUS_LITERALS.values())].filter(v => !reached.has(v));
  check('every ' + label + ' ambiguous value has an example', unexercised.length === 0,
    unexercised.length ? 'unexercised: ' + unexercised.join(', ') : reached.size + ' values');
}

// A bare `return;` is an answer too, and the ambiguous one.
check('a bare return is undefined', classify(null, JS).kind === 'ambiguous' &&
  classify(null, JS).value === 'undefined', '');

// ---------------------------------------------------------------- 4. normalise
//
// The text normaliser is what makes two spellings of one answer compare equal.
// If it ever stops stripping something, rule 4 quietly finds less and no count
// anywhere says why.
check('whitespace does not change an answer',
  normaliseText('{ a: 1 }') === normaliseText('{a:1}'), '');
check('a comment does not change an answer',
  normaliseText('[] /* nothing */') === normaliseText('[]'), '');

console.log('\n  ' + (failed ? failed + ' failed' : 'the vocabulary is coherent'));
if (failed) {
  console.log('\n  A table entry that matches nothing is invisible to every other layer:');
  console.log('  the population shrinks, fewer findings come out, and a smaller number');
  console.log('  reads as cleaner code.');
}
// NOT process.exit(). This layer loads the tree-sitter wasm module, which holds
// async handles; exiting from under them aborts the process on Windows with
// "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" and exit 3221226505.
// The failure was still real, but the runner above would have classified it as
// a crash rather than as a layer that failed — the same defect this file is
// checking the dictionary for, one level up. Setting the code and letting the
// module finish reaches the same status without the abort.
process.exitCode = failed ? 1 : 0;
