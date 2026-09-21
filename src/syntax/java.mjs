// looks-clean — the Java node vocabulary.
//
// MEASURED, NOT GUESSED. Every field name below was read out of a parsed tree
// before it was written down, because four of them do not exist where the
// JavaScript vocabulary expects them — and each absence fails silently:
//
//   * `catch_clause` has NO `parameter` field. Java keeps the binding in a
//     `catch_formal_parameter`, in its `name` field. Read the JavaScript way,
//     every handler has a null binding, so `usesBinding` is never true, so a
//     handler that logs its own error looks mute.
//   * A call is `method_invocation` with `object`/`name`, not `call_expression`
//     with a `function` field. Read the JavaScript way, the callee of every call
//     is the empty string, so NOTHING is a read, so no site has a family, so
//     rules 1 to 3 have not one candidate between them.
//   * `try (X x = open()) { }` is a `try_with_resources_statement`, and the call
//     being guarded sits in its `resources` field, OUTSIDE the `body` block.
//     Taking the body alone leaves the guarded range empty, and the handler
//     standing over the failing read is attributed to no read at all.
//   * A function is a `method_declaration` or a `lambda_expression`, never an
//     `arrow_function`. Read the JavaScript way, a Java file contains no
//     functions, so rule 4 has nothing to compare and every handler is reported
//     as standing at top level.
//
// All four together produced one result on a real file: 0 functions, 0 reads,
// 6 handlers with no family — and `findings: 0`. That was not a clean file. It
// was a file nothing had looked at.
import { normaliseText } from '../values.mjs';

export const name = 'java';

export const FUNCTION_TYPES = new Set([
  'method_declaration', 'constructor_declaration', 'compact_constructor_declaration',
  'lambda_expression',
]);

export const STATEMENT_TYPES = new Set([
  'expression_statement', 'local_variable_declaration', 'field_declaration',
  'return_statement', 'if_statement', 'for_statement', 'enhanced_for_statement',
  'while_statement', 'do_statement', 'throw_statement', 'switch_expression',
  'try_statement', 'try_with_resources_statement', 'labeled_statement',
  'synchronized_statement', 'assert_statement', 'yield_statement',
  'break_statement', 'continue_statement',
  // A resource IS the statement its read lives in. Rule 3 reads the text of the
  // enclosing statement looking for a deadline, and for `try (var s = open(url))`
  // the resource line is the only place one could have been written.
  'resource',
]);

export const IDENT_TYPES = new Set(['identifier', 'field_access']);

export const BLOCK_TYPE = 'block';
export const isBlock = node => !!node && node.type === 'block';

export const isCall = node =>
  node.type === 'method_invocation' || node.type === 'object_creation_expression';

const strip = s => normaliseText(s).replace(/<[^>]*>/g, '').replace(/\([^()]*\)/g, '');

// ------------------------------------------------------------------- values
//
// THE KEY DROPS TYPE ARGUMENTS, and that is the whole reason this is a function
// rather than a plain map lookup. `new ArrayList<>()` and `new ArrayList<File>()`
// are one answer to a caller and two strings on the page, so rule 4 would see
// two different answers on the two paths of a function that collapses them into
// one. Dropping `<...>` can mangle the key of a comparison written without
// spaces (`a<b&&c>d`), which costs nothing: a mangled key matches no literal and
// the value is classified as content, which is what it is.
export const valueKey = node => normaliseText(node.text).replace(/<[^>]*>/g, '');

// `Optional.empty()` is here for the same reason `null` is: it is exactly what a
// successful lookup of something absent returns, so handing it back from a catch
// renames the failure rather than reporting it.
//
// `-1` is deliberately ABSENT. It is a real Java sentinel for "not found", but it
// is also a real error code that a caller is forced to read, and the two cannot
// be told apart from the expression alone.
export const AMBIGUOUS_LITERALS = new Map([
  ['null', 'null'],
  ['false', 'false'],
  ['0', '0'],
  ['0L', '0'],
  ['""', '""'],
  ['newArrayList()', 'new ArrayList<>()'],
  ['newHashMap()', 'new HashMap<>()'],
  ['newHashSet()', 'new HashSet<>()'],
  ['newLinkedList()', 'new LinkedList<>()'],
  ['Collections.emptyList()', 'Collections.emptyList()'],
  ['Collections.emptyMap()', 'Collections.emptyMap()'],
  ['Collections.emptySet()', 'Collections.emptySet()'],
  ['List.of()', 'List.of()'],
  ['Map.of()', 'Map.of()'],
  ['Set.of()', 'Set.of()'],
  ['Optional.empty()', 'Optional.empty()'],
]);

export const UNWRAP_TYPES = new Set(['parenthesized_expression', 'cast_expression']);

/** Java has no object literal, so nothing is tagged by its keys. */
export const OBJECT_LITERAL_TYPE = null;

export const CONSTRUCTION_TYPES = new Set([
  'object_creation_expression', 'array_creation_expression',
]);

/** See values.mjs: `ProjectOpResult.ok(x)` names its outcome in the last segment. */
export const OUTCOME_TAIL = true;

/** A cast names its type first and its value second; a parenthesis holds only the value. */
export const unwrapChild = node =>
  node.childForFieldName('value') || node.namedChild(node.namedChildCount - 1);

function objectText(node) {
  if (node.type === 'method_invocation') return calleeText(node);
  return strip(node.text);
}

/**
 * The callee, built from the tree rather than from the text.
 *
 *   `Files.readAttributes(p, A.class)`            -> `Files.readAttributes`
 *   `StreamSupport.stream(x, false).parallel()`   -> `StreamSupport.stream.parallel`
 *   `new FileInputStream("a")`                    -> `newFileInputStream`
 *
 * Type arguments are dropped: `new ArrayList<>()` and `new ArrayList<File>()`
 * are the same operation, and a family that told them apart would split its own
 * population for a reason no reader would recognise.
 */
export function calleeText(callNode) {
  if (callNode.type === 'object_creation_expression') {
    const ty = callNode.childForFieldName('type');
    return 'new' + (ty ? strip(ty.text) : '');
  }
  if (callNode.type !== 'method_invocation') return '';
  const nm = callNode.childForFieldName('name');
  const obj = callNode.childForFieldName('object');
  const head = obj ? objectText(obj) : '';
  return (head ? head + '.' : '') + (nm ? nm.text : '');
}

/** The head of a call chain: `Files.readAttributes(...)` -> `Files`. */
export function chainHead(callNode) {
  let n = callNode;
  for (let i = 0; n && i < 40; i++) {
    if (n.type === 'method_invocation') {
      const obj = n.childForFieldName('object');
      if (!obj) { const nm = n.childForFieldName('name'); return nm ? nm.text : ''; }
      n = obj;
      continue;
    }
    if (n.type === 'object_creation_expression' || n.type === 'parenthesized_expression' ||
      n.type === 'cast_expression') { n = n.namedChild(0); continue; }
    break;
  }
  return n ? strip(n.text) : '';
}

export function bodyOf(fnNode) {
  return fnNode.childForFieldName('body') || fnNode.namedChild(fnNode.namedChildCount - 1);
}

export function firstParam(fnNode) {
  const p = fnNode.childForFieldName('parameters');
  if (!p) return null;
  if (p.type === 'identifier') return p;                  // `e -> ...`
  const first = p.namedChildCount ? p.namedChild(0) : null;
  if (!first) return null;
  return first.childForFieldName('name') || first;        // formal_parameter -> its name
}

/** The node handed over is already the identifier, so its text is the name. */
export const bindingText = param => normaliseText(param.text);

/** A lambda with an expression body (`x -> go(x)`) returns without a return statement. */
export function expressionBody(fnNode) {
  if (fnNode.type !== 'lambda_expression') return null;
  const body = fnNode.childForFieldName('body');
  if (!body || body.type === 'block') return null;
  return body;
}

export function functionNameOf(node) {
  const own = node.childForFieldName ? node.childForFieldName('name') : null;
  if (own) return own.text;
  const p = node.parent;
  if (!p) return '<anonymous>';
  if (p.type === 'variable_declarator') {
    const n = p.childForFieldName('name');
    if (n) return n.text;
  }
  if (p.type === 'argument_list' && p.parent && isCall(p.parent)) {
    return calleeText(p.parent) + '()';
  }
  return '<anonymous>';
}

function firstOfType(node, type) {
  for (let i = 0; i < node.namedChildCount; i++)
    if (node.namedChild(i).type === type) return node.namedChild(i);
  return null;
}

function guardedRange(tryStmt, fallback) {
  const empty = { from: fallback.startIndex, to: fallback.startIndex };
  if (!tryStmt) return empty;
  const ok = tryStmt.type === 'try_statement' || tryStmt.type === 'try_with_resources_statement';
  if (!ok) return empty;
  const parts = [];
  for (let i = 0; i < tryStmt.namedChildCount; i++) {
    const c = tryStmt.namedChild(i);
    if (c.type === 'catch_clause' || c.type === 'finally_clause') continue;
    parts.push(c);
  }
  if (!parts.length) return empty;
  return { from: parts[0].startIndex, to: parts[parts.length - 1].endIndex };
}

/**
 * A `catch` clause, or null.
 *
 * THE GUARDED RANGE SPANS THE RESOURCES TOO. `try (var s = Files.newDirectoryStream(p))`
 * performs the read that fails in its `resources` field, not in its body, and a
 * range computed from the body alone finds no read, leaves the handler with no
 * family, and drops it from every rule that needs one.
 */
export function catchSiteOf(node) {
  if (node.type !== 'catch_clause') return null;
  const body = node.childForFieldName('body');
  const formal = firstOfType(node, 'catch_formal_parameter');
  const guarded = guardedRange(node.parent, node);
  return {
    body: body || node.namedChild(node.namedChildCount - 1),
    param: formal ? formal.childForFieldName('name') : null,
    guardedFrom: guarded.from,
    guardedTo: guarded.to,
  };
}

/** Java has no promise chain, so no handler of that kind exists. */
export const promiseCatchOf = () => null;

/** Nor a callback whose every return answers a failure. */
export const isFailureOnlyCallback = () => false;
