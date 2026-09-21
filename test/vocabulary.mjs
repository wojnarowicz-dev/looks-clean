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
import * as DART from '../src/syntax/dart.mjs';
import { analyse } from '../src/ir.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');

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
  ['net', 'client.send', 'client'],
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
  ['Io.readStringWithRetry', 'Io', 'a project-local IO wrapper: deliberately absent, see reads.mjs'],
  ['someFile.exists', 'someFile', 'java.io.File methods are left out, so this under-reports'],
];

for (const [family, callee, head] of FAMILY_EXAMPLES) {
  const got = familyOf(callee, head, 'js');
  check('js read: ' + callee, got === family, got === family ? family : 'read as ' + got);
}
for (const [callee, head, why] of NOT_READS) {
  const got = familyOf(callee, head, 'js');
  check('js not a read: ' + callee, got === null, got === null ? why.slice(0, 46) : 'read as ' + got);
}
// DART. The supabase rows are the same matcher the JavaScript table uses,
// reached through a Dart chain — which is the measurement that said this
// language needed one row rather than a table.
const DART_FAMILY_EXAMPLES = [
  ['supabase', 'supabase.from.select', 'supabase'],
  ['supabase', 'supabase.functions.invoke', 'supabase'],
  ['supabase', 'supabase.auth.signOut', 'supabase'],
  ['supabase', 'client.functions.invoke', 'client'],
  ['storage', 'SharedPreferences.getInstance', 'SharedPreferences'],
  ['storage', 'prefs.getString', 'prefs'],
  ['storage', 'prefs.setString', 'prefs'],
  // Every spelling below was counted in the material, not recalled from the
  // API. The receiver differs almost every time, which is why the fs row
  // keys on the tail.
  ['fs', 'file.readAsStringSync', 'file'],
  ['fs', 'File.existsSync', 'File'],
  ['fs', 'quickHashFile.writeAsStringSync', 'quickHashFile'],
  ['fs', 'entity.readAsLines', 'entity'],
  ['fs', 'src.listSync', 'src'],
  ['fs', 'getTemporaryDirectory', 'getTemporaryDirectory'],
  // The bare async names are reached only when the chain says so itself.
  ['fs', 'File(_getWindowsFilePath).exists', 'File'],
  ['fs', 'File.delete', 'File'],
  ['net', 'http.get', 'http'],
  ['net', 'http.head', 'http'],
  ['net', 'client.postUrl', 'client'],
  ['net', 'Socket.connect', 'Socket'],
  ['db', 'localDatabase.database.query', 'localDatabase'],
  ['db', 'databaseExecutor.rawInsert', 'databaseExecutor'],
  ['db', 'db.execute', 'db'],
  ['db', 'rawInsert', 'rawInsert'],
  ['db', 'openDatabase', 'openDatabase'],
  ['assets', 'rootBundle.loadString', 'rootBundle'],
  ['assets', 'assetBundle.loadString', 'assetBundle'],
  ['assets', 'rootBundle.load', 'rootBundle'],
];

const DART_NOT_READS = [
  ['supabase.from', 'supabase', 'the start of a chain, not an operation'],
  ['setState', 'setState', 'a widget rebuild — the commonest call in the material'],
  ['Navigator.of.push', 'Navigator', 'navigation, not a read'],
  ['debugPrint', 'debugPrint', 'writing to the console'],
  ['jsonDecode', 'jsonDecode', 'a string the program already holds: the Java decision, applied again'],
  ['Duration', 'Duration', 'a value, and it appears beside almost every animation'],
  ['notifyListeners', 'notifyListeners', 'a notification to this program'],
  // EACH OF THESE WAS COUNTED IN THE MATERIAL AND WOULD HAVE BEEN REPORTED BY
  // a wider row. They are the reason the rows are shaped the way they are.
  ['File', 'File', 'a constructor: it touches no disk until something is read'],
  ['Directory', 'Directory', 'the same, 22 of them'],
  ['_getBox.delete', '_getBox', 'a key-value box, not a file'],
  ['daoProductList.delete', 'daoProductList', 'a data access object'],
  ['barcodes.insert', 'barcodes', 'List.insert, a core method — 16 such calls'],
  ['children.insert', 'children', 'the same, on a widget list'],
  ['Overlay.of.insert', 'Overlay', 'inserting an overlay entry'],
  ['BarcodeParameter.list', 'BarcodeParameter', 'a list of parameters, not a directory'],
  ['NetworkInterface.list', 'NetworkInterface', 'interfaces, not files'],
  ['ref.notifier.rename', 'ref', 'renaming in a state notifier'],
  ['TransferNotification.update', 'TransferNotification', 'a notification, not a row'],
  ['task.execute', 'task', 'running a task, not a statement'],
  ['image.getUrl', 'image', 'builds an address and fetches nothing — six such calls'],
  ['client.close', 'client', 'closing a client is not a read'],
];

for (const [family, callee, head] of DART_FAMILY_EXAMPLES) {
  const got = familyOf(callee, head, 'dart');
  check('dart read: ' + callee, got === family, got === family ? family : 'read as ' + got);
}
for (const [callee, head, why] of DART_NOT_READS) {
  const got = familyOf(callee, head, 'dart');
  check('dart not a read: ' + callee, got === null, got === null ? why.slice(0, 44) : 'read as ' + got);
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
  const rows = { js: FAMILY_EXAMPLES, java: JAVA_FAMILY_EXAMPLES, dart: DART_FAMILY_EXAMPLES }[lang];
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

// ------------------------------------------------- 3. preconditions
//
// The fourth table: which operand spells "this argument is absent". It decides
// whether a `return` above the try is the empty path or a guard on the question,
// and rule 4 collided the two until 0.2.1. A row that stops matching here goes
// straight back to reporting methods that never collapsed anything.
//
// The PRESENCE rows are the half that matters. `x != null` differs from
// `x == null` by one character and means the opposite, and a regex written in a
// hurry takes both.
const ABSENT = [
  ['js', 'x===null', '== null'],
  ['js', 'x==null', '== null'],
  ['js', 'null===x', 'null =='],
  ['js', 'x===undefined', '== undefined'],
  ['js', '!x', 'falsy'],
  ['js', "x===''", 'empty string'],
  ['js', 'x.length===0', 'length 0'],
  ['js', '!x.length', 'no length'],
  ['js', "x.trim()===''", 'trimmed empty'],
  ['java', 'x==null', '== null'],
  ['java', 'null==x', 'null =='],
  ['java', 'x.isEmpty()', 'isEmpty()'],
  ['java', 'x.isBlank()', 'isBlank()'],
  ['java', 'x.trim().isEmpty()', 'trimmed empty'],
  ['java', 'x.length()==0', 'length 0'],
  ['dart', 'x==null', '== null'],
  ['dart', 'null==x', 'null =='],
  ['dart', 'x.isEmpty', 'isEmpty'],
  ['dart', 'x.trim().isEmpty', 'trimmed empty'],
  ['dart', 'x.length==0', 'length 0'],
  ['dart', "x==''", 'empty string'],
];

const NOT_ABSENT = [
  ['js', 'x!==null', 'a test for PRESENCE, and one character from its opposite'],
  ['js', 'x', 'a truthiness test, not an absence test'],
  ['js', 'x.length>0', 'the other direction'],
  ['java', 'x!=null', 'a test for PRESENCE'],
  ['java', 'x.isPresent()', 'the opposite of empty'],
  ['java', 'x.size()<4', 'a size the caller chose, not an absence'],
  ['java', 'x.exists()', 'a question about the disk, not about the argument'],
  ['dart', 'x!=null', 'a test for PRESENCE'],
  ['dart', 'x.isNotEmpty', 'the opposite, and one word longer'],
  ['dart', 'x.isEmpty()', 'isEmpty is a getter in Dart; with parentheses it is something else'],
];

for (const [lang, operand, label] of ABSENT) {
  const syn = { js: JS, java: JAVA, dart: DART }[lang];
  const hit = syn.ABSENCE_TESTS.find(([, re]) => re.test(operand));
  check(lang + ' absent: ' + operand, !!hit && hit[0] === label,
    hit ? 'matched ' + hit[0] : 'matched nothing');
}
for (const [lang, operand, why] of NOT_ABSENT) {
  const syn = { js: JS, java: JAVA, dart: DART }[lang];
  const hit = syn.ABSENCE_TESTS.find(([, re]) => re.test(operand));
  check(lang + ' not absent: ' + operand, !hit, hit ? 'matched ' + hit[0] : why.slice(0, 44));
}

for (const [label, syn] of [['js', JS], ['java', JAVA], ['dart', DART]]) {
  const covered = new Set(ABSENT.filter(r => r[0] === label).map(r => r[2]));
  const unexercised = syn.ABSENCE_TESTS.map(([n]) => n).filter(n => !covered.has(n));
  check('every ' + label + ' absence test has an example', unexercised.length === 0,
    unexercised.length ? 'unexercised: ' + unexercised.join(', ') : covered.size + ' spellings');
}

// ONE INTERFACE, THREE MODULES, AND NOTHING WAS CHECKING THAT. ir.mjs reaches
// into whatever `syn` it is handed — `syn.TRACE_NAMES.has(tail)` and the rest —
// so a member added to one module and forgotten in another throws on the first
// file of that language and on no test here. It fails loudly rather than
// quietly, which is the right failure, but it fails in someone's repository
// rather than in this run.
//
// Found while widening the interface by two members by hand across three files.
{
  const mods = [['js', JS], ['java', JAVA], ['dart', DART]];
  const names = m => Object.keys(m).sort();
  const union = [...new Set(mods.flatMap(([, m]) => names(m)))].sort();
  for (const [label, m] of mods) {
    const missing = union.filter(k => !(k in m));
    check(label + ' speaks the whole syntax interface', missing.length === 0,
      missing.length ? 'missing: ' + missing.join(', ') : union.length + ' members');
  }
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
  'new SomeResult.Ok(ref)',
  'SomeResult.failure(msg)',
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

// ------------------------------------------- 4. the grammar we carry ourselves
//
// THE ONE DEPENDENCY THAT IS NOT A DEPENDENCY. The Dart grammar is a file in
// vendor/ rather than a package, because the package that publishes it compiles
// a native binding on install and ships no prebuild for it. A carried file has
// its own failure mode: nobody notices when it is replaced, truncated, or
// normalised to LF by a checkout. So its bytes are hashed against the record
// kept beside it, and then it is made to do its job on a fixture.
{
  const record = JSON.parse(fs.readFileSync(path.join(REPO, 'vendor', 'grammars.json'), 'utf8'));
  const row = record.grammars.find(g => g.language === 'dart');
  check('the carried grammar is recorded', !!row, row ? row.source + '@' + row.version : 'no row');

  const file = path.join(REPO, 'vendor', row.file);
  const bytes = fs.readFileSync(file);
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  check('the carried grammar is the recorded one', sha === row.sha256 && bytes.length === row.bytes,
    sha === row.sha256 ? bytes.length + ' bytes' : 'sha256 ' + sha.slice(0, 16) + '… vs ' + row.sha256.slice(0, 16) + '…');
  check('its licence travels with it',
    fs.existsSync(path.join(REPO, 'vendor', 'tree-sitter-dart.LICENSE')), 'MIT, beside the file');

  // AND THEN IT HAS TO PARSE. A file whose hash is right and whose contents are
  // not a usable grammar would pass every check above.
  const dartParser = await parserFor('fixture.dart');
  const source = fs.readFileSync(path.join(HERE, 'fixtures', 'dart', 'handlers.dart'), 'utf8');
  const tree = dartParser.parse(source);
  check('the carried grammar parses Dart', !tree.rootNode.hasError, 'no ERROR node');

  const ir = analyse(tree, 'handlers.dart', 0, DART);
  check('it finds the functions', ir.functions.length >= 5, ir.functions.length + ' functions');

  // THE THREE SHAPES, AND THE THIRD IS THE POINT. `on X { }` carries no
  // catch_clause node at all; a vocabulary keying on the node type sees nothing
  // there and reports the file clean. 31 of them stand in the material this was
  // measured against.
  const named = n => ir.handlers.filter(h => h.fnName === n);
  check('`catch (e)` is a handler', named('plain').length === 1,
    named('plain').length + ' found');
  check('`on X catch (e)` is a handler', named('typed').length === 1,
    named('typed').length + ' found');
  check('`on X { }` is a handler, with no binding',
    named('untyped').length === 1 && named('untyped')[0].binding === null,
    named('untyped').length + ' found, binding=' + (named('untyped')[0] || {}).binding);

  // The body is the sibling of the clause, so a handler found with an empty
  // body is a vocabulary that descended where it should have stepped sideways.
  check('a handler body is found beside the clause',
    ir.handlers.every(h => h.snippet && h.snippet.length > 1),
    ir.handlers.length + ' handlers, all with a body');

  // `rethrow` is an expression in Dart. Asked for a statement, every handler
  // that hands the failure on reads as one that swallows it.
  check('`rethrow` counts as handing the failure on',
    named('handsOn').length === 1 && named('handsOn')[0].effects.rethrows,
    'rethrows=' + (named('handsOn')[0] || {}).effects?.rethrows);

  // And the guard above the try is not the empty path.
  const guarded = ir.functions.find(f => f.name === 'guarded');
  check('a guard on an argument is marked as one',
    !!guarded && guarded.returns.some(r => r.path === 'normal' && r.guard),
    guarded ? guarded.returns.filter(r => r.guard).length + ' guard return(s)' : 'no function');
}

// THE TRACE A HANDLER LEAVES, IN DART'S OWN SPELLINGS. Rule 1 asks one
// question — did this handler use the failure at all — and answers it from
// `effects`. Two Dart spellings were invisible to that question, so handlers
// that printed the error they caught were reported as swallowing it. Measured
// 2026-09-21: five of six false alarms on a Flutter application were this.
//
// The control matters more than the four positives. A vocabulary widened until
// everything leaves a trace reports nothing and passes every case above it.
{
  const dartParser = await parserFor('fixture.dart');
  const source = fs.readFileSync(path.join(HERE, 'fixtures', 'dart', 'traces.dart'), 'utf8');
  const tree = dartParser.parse(source);
  check('the trace fixture parses', !tree.rootNode.hasError, 'no ERROR node');

  const ir = analyse(tree, 'traces.dart', 0, DART);
  const fx = n => ir.handlers.find(h => h.fnName === n);

  // An interpolated binding is an identifier_dollar_escaped, not an identifier.
  check('dart trace: an interpolated binding is used',
    !!fx('interpolated') && fx('interpolated').effects.usesBinding === true,
    'usesBinding=' + (fx('interpolated') || {}).effects?.usesBinding);
  check('dart trace: a braced interpolation still uses the binding',
    !!fx('braced') && fx('braced').effects.usesBinding === true,
    'usesBinding=' + (fx('braced') || {}).effects?.usesBinding);

  // debugPrint is Flutter's console; print is Dart's.
  check('dart trace: debugPrint is a log',
    !!fx('noDetail') && fx('noDetail').effects.logs === true,
    'logs=' + (fx('noDetail') || {}).effects?.logs);
  check('dart trace: print is a log',
    !!fx('plainPrint') && fx('plainPrint').effects.logs === true,
    'logs=' + (fx('plainPrint') || {}).effects?.logs);

  // THE CONTROL.
  const silent = fx('silent');
  check('dart trace: a handler that says nothing still says nothing',
    !!silent && !silent.effects.usesBinding && !silent.effects.logs &&
    !silent.effects.rethrows && !silent.effects.assignsErrorTarget,
    silent ? 'no trace, as it should be' : 'no handler');
}

// A COMMAND AND A QUERY THAT DIFFER IN NOTHING A HANDLER CAN SEE. Rule 2 asks
// whether a caller can tell the failure answer from the empty result. Under a
// write there is no empty result, so `false` reports the failure rather than
// disguising it — but the handler alone cannot tell the two apart. Only the
// success return can: a constant means the operation's value never became the
// answer.
//
// The query is the half that matters. A correction that silenced it would have
// removed a real defect to remove a false alarm, and the run would have looked
// better for it.
{
  const dartParser = await parserFor('fixture.dart');
  const source = fs.readFileSync(path.join(HERE, 'fixtures', 'dart', 'commands.dart'), 'utf8');
  const tree = dartParser.parse(source);
  check('the command fixture parses', !tree.rootNode.hasError, 'no ERROR node');

  const ir = analyse(tree, 'commands.dart', 0, DART);
  const fn = n => ir.functions.find(f => f.name === n);
  const hd = n => ir.handlers.find(h => h.fnName === n);

  // TWO HALVES, AND NEITHER IS ENOUGH ALONE. constantAnswers says the answer
  // is written into the source; opDiscarded says the operation's value never
  // became it. The Java fixture below is the proof that the first half alone
  // is not a command test.
  check('dart command: a write answering a constant hands back no data',
    !!fn('giveConsent') && fn('giveConsent').constantAnswers === true &&
    !!hd('giveConsent') && hd('giveConsent').opDiscarded === true,
    'constantAnswers=' + (fn('giveConsent') || {}).constantAnswers +
    ' opDiscarded=' + (hd('giveConsent') || {}).opDiscarded);
  check('dart query: a read that becomes the answer still can',
    !!fn('hasConsent') && fn('hasConsent').constantAnswers === false &&
    !!hd('hasConsent') && hd('hasConsent').opDiscarded === false,
    'constantAnswers=' + (fn('hasConsent') || {}).constantAnswers +
    ' opDiscarded=' + (hd('hasConsent') || {}).opDiscarded);

  // The boundary, stated so that a later widening has to argue with it.
  check('dart command: a list answer is not a constant answer',
    !!fn('purge') && fn('purge').constantAnswers === false,
    'constantAnswers=' + (fn('purge') || {}).constantAnswers);
}

// THE SHAPE THAT BROKE THE FIRST VERSION OF THIS. "Every return is a
// constant" is true of a query that tests its read in a branch and answers
// with a literal either way, and calling that a command removed four real
// findings from Java material that had not moved in any release. The two
// methods below differ in one thing only: whether the guarded operation's
// value goes anywhere.
{
  const javaFixtureParser = await parserFor('Fixture.java');
  const source = fs.readFileSync(path.join(HERE, 'fixtures', 'java', 'Commands.java'), 'utf8');
  const tree = javaFixtureParser.parse(source);
  check('the java command fixture parses', !tree.rootNode.hasError, 'no ERROR node');

  const ir = analyse(tree, 'Commands.java', 0, JAVA);
  const hd = n => ir.handlers.find(h => h.fnName === n);
  const fn = n => ir.functions.find(f => f.name === n);

  check('java: both shapes answer with constants',
    !!fn('hasLayout') && !!fn('discard') &&
    fn('hasLayout').constantAnswers === true && fn('discard').constantAnswers === true,
    'hasLayout=' + (fn('hasLayout') || {}).constantAnswers +
    ' discard=' + (fn('discard') || {}).constantAnswers);
  check('java query: a read tested in a branch is not discarded',
    !!hd('hasLayout') && hd('hasLayout').opDiscarded === false,
    'opDiscarded=' + (hd('hasLayout') || {}).opDiscarded);
  check('java command: a write standing alone is discarded',
    !!hd('discard') && hd('discard').opDiscarded === true,
    'opDiscarded=' + (hd('discard') || {}).opDiscarded);
}

// ---------------------------------------------------------------- 5. normalise
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
