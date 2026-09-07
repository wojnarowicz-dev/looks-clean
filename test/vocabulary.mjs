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
import { familyOf, timeoutMarker, FAMILY_NAMES } from '../src/reads.mjs';
import { classify, normaliseText } from '../src/values.mjs';

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

for (const [family, callee, head] of FAMILY_EXAMPLES) {
  const got = familyOf(callee, head);
  check('read: ' + callee, got === family, got === family ? family : 'read as ' + got);
}
for (const [callee, head, why] of NOT_READS) {
  const got = familyOf(callee, head);
  check('not a read: ' + callee, got === null, got === null ? why.slice(0, 46) : 'read as ' + got);
}

// Every family named in the code must be exercised above. A family with no
// example is a row nothing tests.
const covered = new Set(FAMILY_EXAMPLES.map(e => e[0]));
const unexercised = FAMILY_NAMES.filter(f => !covered.has(f));
check('every family has an example', unexercised.length === 0,
  unexercised.length ? 'unexercised: ' + unexercised.join(', ') : FAMILY_NAMES.length + ' families');

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
];

for (const [stmt, marker] of GUARDED) {
  const got = timeoutMarker(stmt);
  check('deadline: ' + marker, got === marker, got === marker ? '' : 'seen as ' + JSON.stringify(got));
}
for (const stmt of UNGUARDED) {
  const got = timeoutMarker(stmt);
  check('no deadline: ' + stmt.slice(0, 40), got === null, got === null ? '' : 'seen as ' + got);
}

// ---------------------------------------------------------------- 3. answers
const parser = await parserFor('vocabulary.ts');

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

for (const [src, canonical] of AMBIGUOUS) {
  const c = classify(expression(src));
  check('ambiguous: ' + src, c.kind === 'ambiguous' && c.value === canonical,
    c.kind === 'ambiguous' ? 'reduced to ' + c.value : 'classified ' + c.kind);
}
for (const src of TAGGED) {
  const c = classify(expression(src));
  check('tagged: ' + src.slice(0, 40), c.kind === 'tagged', 'classified ' + c.kind);
}
for (const src of OTHER) {
  const c = classify(expression(src));
  check('other: ' + src.slice(0, 40), c.kind === 'other', 'classified ' + c.kind);
}

// A bare `return;` is an answer too, and the ambiguous one.
check('a bare return is undefined', classify(null).kind === 'ambiguous' &&
  classify(null).value === 'undefined', '');

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
