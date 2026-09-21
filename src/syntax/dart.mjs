// looks-clean — the Dart node vocabulary.
//
// MEASURED AGAINST THE GRAMMAR IN vendor/, not against memory. Dart differs
// from both languages already here in three ways that are not new spellings but
// new questions, and each one is silent when got wrong:
//
//   * AN `if` HAS NO `condition` FIELD. JavaScript and Java both hand it over by
//     name; here the condition is simply the first named child. Read the old
//     way, every condition is null, so no error branch is ever recognised and no
//     precondition is ever spotted.
//   * THE BODY OF A `catch` IS ITS SIBLING, not its child. A `try_statement` is
//     a flat list — `block, [type_identifier], [catch_clause], block, ...` — so
//     a handler and the code it guards are found by position among the parent's
//     children, not by descending.
//   * `on FormatException { }` IS A HANDLER WITH NO `catch_clause` NODE AT ALL,
//     and there are 31 of them in the material this was measured against. Keying
//     on the node type alone makes every one of them invisible: a handler that
//     swallows a failure, not reported, because the tool never saw it was a
//     handler.
//
// And one that is not structural but matters as much: `throw` and `rethrow` are
// EXPRESSIONS in Dart, not statements. A rule asking for `throw_statement` finds
// nothing, and every handler that rethrows reads as one that swallows.
import { normaliseText } from '../values.mjs';

export const name = 'dart';

// A function is the declaration, not the body: the returns inside it belong to
// it either way, and the signature that carries its name is a child.
export const FUNCTION_TYPES = new Set([
  'function_declaration', 'method_declaration', 'function_expression',
]);

export const STATEMENT_TYPES = new Set([
  'expression_statement', 'local_variable_declaration', 'return_statement',
  'if_statement', 'for_statement', 'while_statement', 'do_statement',
  'switch_statement', 'try_statement', 'break_statement', 'continue_statement',
  'yield_statement', 'assert_statement', 'labeled_statement',
]);

export const IDENT_TYPES = new Set(['identifier']);

// THE SPELLING THAT MADE A HANDLER LOOK SILENT. `'failed: $e'` does not hold
// an `identifier`; the grammar calls the interpolated name
// `identifier_dollar_escaped`. A handler printing the very error it caught
// therefore read as one that never touched it. `${e.message}` was always
// visible, because the braced form holds a plain identifier — so the defect
// depended on which of two equivalent spellings the author had used.
export const BINDING_REF_TYPES = new Set(['identifier', 'identifier_dollar_escaped']);

// Dart's own console call, and Flutter's. Neither matches the shared
// vocabulary, which was written for `console.*` and the JavaScript logging
// packages. `print` is listed here and nowhere else for that reason.
export const TRACE_NAMES = new Set(['debugPrint', 'print']);

// See the note in js.mjs.

// WHETHER AN OPERATION'S VALUE GOES ANYWHERE. Used only to tell a write from a
// read — see valueDiscarded in ir.mjs. Kept apart from UNWRAP_TYPES on
// purpose: that set feeds classify() and valueKey(), and widening it would
// move numbers in every rule.
export const EXPRESSION_STATEMENT_TYPE = 'expression_statement';
// This grammar wraps `await x` in a unary_expression, so it belongs here —
// unlike in Java, where a unary_expression is `!x` and consumes its operand.
// The two cannot be confused, because this set is only ever consulted under an
// expression statement, and `!f();` is not a statement anyone writes.
export const STATEMENT_WRAPPER_TYPES = new Set([
  'await_expression', 'unary_expression', 'parenthesized_expression',
]);

export const LITERAL_TYPES = new Set([
  'true', 'false', 'null_literal', 'string_literal',
  'decimal_integer_literal', 'hex_integer_literal',
  'decimal_floating_point_literal',
]);

/** `throw` and `rethrow` are expressions here, which is why this is a table. */
export const RETHROW_TYPES = new Set(['throw_expression', 'rethrow_expression']);

/**
 * THE QUESTION THIS LANGUAGE CANNOT ANSWER BY NODE TYPE.
 *
 * A handler body here is a SIBLING of its clause, not a child, so walking up
 * from a `return` never meets a `catch_clause` — it meets a `block` whose
 * parent is the `try`. Every return inside a Dart catch was therefore labelled
 * `normal` while JavaScript and Java labelled the same code `failure`:
 *
 *   dart  true:normal  false:normal
 *   java  true:normal  false:failure
 *   js    true:normal  false:failure
 *
 * The child list is flat and the first block is the guarded part, so every
 * LATER block that is a direct child of the try is a handler body — for all
 * three spellings, including `on X { }`, which has no clause at all:
 *
 *   try <> block <> catch_clause <> block
 *   try <> block <> on <> type_identifier <> catch_clause <> block
 *   try <> block <> on <> type_identifier <> block
 *
 * A `finally` cannot be mistaken for one: the grammar wraps it in a
 * `finally_clause` rather than leaving its block a direct child.
 */
export function isHandlerBody(node) {
  const p = node.parent;
  if (node.type !== 'block' || !p || p.type !== 'try_statement') return false;
  const blocks = namedKids(p).filter(k => k.type === 'block');
  return blocks.length > 1 && blocks[0].id !== node.id;
}

export const BLOCK_TYPE = 'block';
export const isBlock = node => !!node && node.type === 'block';

/** An `if` hands its condition over by position, not by name. */
export const conditionOf = node => node.namedChild(0);

export const isCall = node => node.type === 'method_invocation';

const namedKids = node => {
  const out = [];
  for (let i = 0; i < node.namedChildCount; i++) out.push(node.namedChild(i));
  return out;
};

const strip = s => normaliseText(s).replace(/<[^>]*>/g, '');

/**
 * The callee is the text in front of the call's last argument list.
 *
 * `sb.from('dreams').select()` is a method_invocation containing another one,
 * and the grammar gives neither an `object` nor a `name` field — so the callee
 * is read off the source instead: everything before the final `argument_part`,
 * with the inner arguments squeezed out.
 *
 *   `sb.from('dreams').select()`  ->  `sb.from.select`
 *
 * Which is the same shape the supabase matcher in reads.mjs already expects, so
 * a Dart chain is recognised by the table that was written for JavaScript.
 */
export function calleeText(callNode) {
  if (callNode.type !== 'method_invocation') return '';
  const parts = namedKids(callNode).filter(k => k.type === 'argument_part');
  const last = parts[parts.length - 1];
  const head = last
    ? callNode.text.slice(0, last.startIndex - callNode.startIndex)
    : callNode.text;
  return strip(head).replace(/\([^()]*\)/g, '');
}

export const chainHead = callNode => calleeText(callNode).split('.')[0] || '';

const signatureOf = fnNode => {
  let found = null;
  const walk = n => {
    if (found) return;
    if (n.type === 'function_signature') { found = n; return; }
    for (let i = 0; i < n.namedChildCount; i++) walk(n.namedChild(i));
  };
  walk(fnNode);
  return found;
};

const paramListOf = fnNode => {
  let found = null;
  const walk = n => {
    if (found) return;
    if (n.type === 'formal_parameter_list') { found = n; return; }
    if (n.type === 'function_body' || n.type === 'function_expression_body') return;
    for (let i = 0; i < n.namedChildCount; i++) walk(n.namedChild(i));
  };
  walk(fnNode);
  return found;
};

export function bodyOf(fnNode) {
  for (const k of namedKids(fnNode))
    if (k.type === 'function_body' || k.type === 'function_expression_body')
      return isBlock(k.namedChild(0)) ? k.namedChild(0) : k;
  return isBlock(fnNode.namedChild(fnNode.namedChildCount - 1))
    ? fnNode.namedChild(fnNode.namedChildCount - 1) : fnNode;
}

export function firstParam(fnNode) {
  const list = paramListOf(fnNode);
  if (!list) return null;
  let found = null;
  const walk = n => {
    if (found) return;
    if (n.type === 'identifier') { found = n; return; }
    for (let i = 0; i < n.namedChildCount; i++) walk(n.namedChild(i));
  };
  walk(list);
  return found;
}

/** A parameter's TYPE is a `type_identifier`, so only plain identifiers are names. */
export function parameterNames(fnNode) {
  const out = new Set();
  const list = paramListOf(fnNode);
  if (!list) return out;
  const walk = n => {
    if (n.type === 'identifier') out.add(n.text);
    for (let i = 0; i < n.namedChildCount; i++) walk(n.namedChild(i));
  };
  walk(list);
  return out;
}

export const bindingText = param => normaliseText(param.text);

/** `(y) => y * 2` and `int n() => 1;` both answer without a return statement. */
export function expressionBody(fnNode) {
  for (const k of namedKids(fnNode)) {
    if (k.type !== 'function_body' && k.type !== 'function_expression_body') continue;
    const inner = k.namedChild(0);
    if (inner && !isBlock(inner)) return inner;
  }
  return null;
}

export function functionNameOf(node) {
  const sig = signatureOf(node);
  const own = sig ? sig.childForFieldName('name') : null;
  if (own) return own.text;
  const p = node.parent;
  if (!p) return '<anonymous>';
  if (p.type === 'initialized_variable_definition' || p.type === 'initialized_identifier') {
    const id = namedKids(p).find(k => k.type === 'identifier');
    if (id) return id.text;
  }
  // A callback takes the name of the call it was handed to, as in JavaScript.
  for (let n = p, hops = 0; n && hops < 4; n = n.parent, hops++)
    if (n.type === 'method_invocation') return calleeText(n) + '()';
  return '<anonymous>';
}

/**
 * The source a `try` guards: everything before its first handler.
 *
 * `try { a(); } on X { b(); } catch (e) { c(); }` — the guarded part is the
 * leading block, and both handlers stand over it.
 */
function guardedRange(tryNode, fallback) {
  const kids = namedKids(tryNode);
  const first = kids.findIndex(k => k.type === 'catch_clause' || k.type === 'type_identifier');
  const guarded = first === -1 ? kids.filter(k => k.type !== 'finally_clause') : kids.slice(0, first);
  if (!guarded.length) return { from: fallback.startIndex, to: fallback.startIndex };
  return { from: guarded[0].startIndex, to: guarded[guarded.length - 1].endIndex };
}

/**
 * A handler, in either of the two shapes Dart writes one.
 *
 *   catch (e) { }           the clause, with its body as the NEXT sibling
 *   on X catch (e) { }      the same, with a type in front of it
 *   on X { }                NO CLAUSE AT ALL: a type, then a block
 *
 * The third is why this cannot key on a node type. It is a real handler, it
 * swallows in exactly the way rule 1 exists to report, and it has no binding —
 * so it can never use the error it caught.
 */
export function catchSiteOf(node) {
  const parent = node.parent;
  if (!parent || parent.type !== 'try_statement') return null;

  const kids = namedKids(parent);
  const at = kids.findIndex(k => k.id === node.id);
  if (at === -1) return null;
  const next = kids[at + 1];

  if (node.type === 'catch_clause') {
    const params = namedKids(node).find(k => k.type === 'catch_parameters');
    const guarded = guardedRange(parent, node);
    return {
      body: isBlock(next) ? next : null,
      param: params ? params.namedChild(0) : null,
      guardedFrom: guarded.from,
      guardedTo: guarded.to,
    };
  }

  // `on X { }` — a type followed straight by a block, with no clause between.
  if (node.type === 'type_identifier' && isBlock(next)) {
    const guarded = guardedRange(parent, node);
    return { body: next, param: null, guardedFrom: guarded.from, guardedTo: guarded.to };
  }
  return null;
}

/** Dart awaits futures rather than chaining them, so there is no `.catch()` shape. */
export const promiseCatchOf = () => null;
export const isFailureOnlyCallback = () => false;

// ------------------------------------------------------------------- values
//
// Counted, not remembered. Of 105 catch clauses in the material, 46 return
// nothing, 43 return bare, and 14 answer with a value: `false` 4, `const []` 4,
// `''` 3, `null` 3. `const []` is a spelling of its own and needs its own row —
// it is the same empty list, written the way Dart writes a constant one.
export const valueKey = node => normaliseText(node.text).replace(/<[^>]*>/g, '');

export const AMBIGUOUS_LITERALS = new Map([
  ['null', 'null'],
  ['false', 'false'],
  ['0', '0'],
  ["''", "''"],
  ['""', "''"],
  ['[]', '[]'],
  ['const[]', '[]'],
  ['{}', '{}'],
  ['const{}', '{}'],
  ['0.0', '0'],
]);

export const UNWRAP_TYPES = new Set([
  'parenthesized_expression', 'type_cast_expression', 'await_expression',
]);

/** Every Dart wrapper puts the value it wraps first. */
export const unwrapChild = node => node.namedChild(0);

/** Dart has map literals, but a map is not an outcome the way an object key is. */
export const OBJECT_LITERAL_TYPE = null;

export const CONSTRUCTION_TYPES = new Set(['list_literal', 'set_or_map_literal']);

/** `Result.ok(x)` and `Either.left(e)` name the outcome in the last segment. */
export const OUTCOME_TAIL = true;

// ------------------------------------------------------------- preconditions
export const PRECONDITION_NAMES = new Set(['isEmpty', 'trim', 'length']);

/** `isEmpty` is a getter in Dart, so it carries no parentheses. */
export const ABSENCE_TESTS = [
  ['== null', /^\w+==null$/],
  ['null ==', /^null==\w+$/],
  ['isEmpty', /^\w+\.isEmpty$/],
  ['trimmed empty', /^\w+\.trim\(\)\.isEmpty$/],
  ['length 0', /^\w+\.length==0$/],
  ['empty string', /^\w+==(''|"")$/],
];
