// looks-clean — the JavaScript/TypeScript node vocabulary.
//
// EVERYTHING HERE USED TO LIVE INLINE IN ir.mjs, and it had to come out before a
// second language could be read at all. Pointed at a Java file, the old ir.mjs
// produced 0 functions, 0 reads and 6 handlers with no family — because every
// one of its questions was spelled in tree-sitter-javascript's node types:
// `call_expression` with a `function` field, `catch_clause` with a `parameter`
// field, `arrow_function` for a callback. Java answers `method_invocation` with
// `object`/`name`, `catch_formal_parameter`, `lambda_expression`, so the tool
// read the file, found nothing, and printed `findings: 0`.
//
// That is this project's own subject matter: a failure indistinguishable from an
// empty result. Splitting the vocabulary out is what makes the failure
// impossible to repeat quietly — a language either has an entry here or it is
// not in `parser.mjs`, and there is no third state where it is read and
// understood by nobody.
//
// WHAT A VOCABULARY OWES THE RULES. ir.mjs asks the questions ("is this a call",
// "what does this clause handle"); a module in this directory answers them for
// one grammar. No rule ever sees a node type.
import { normaliseText } from '../values.mjs';

export const name = 'js';

export const FUNCTION_TYPES = new Set([
  'function_declaration', 'function_expression', 'function',
  'generator_function', 'generator_function_declaration',
  'arrow_function', 'method_definition',
]);

export const STATEMENT_TYPES = new Set([
  'expression_statement', 'lexical_declaration', 'variable_declaration',
  'return_statement', 'if_statement', 'for_statement', 'for_in_statement',
  'while_statement', 'do_statement', 'throw_statement', 'switch_statement',
  'try_statement', 'labeled_statement', 'public_field_definition',
]);

/** The node types that spell a name, for reading an `if` condition. */
export const IDENT_TYPES = new Set([
  'identifier', 'property_identifier', 'shorthand_property_identifier',
]);

// A SEPARATE, NARROWER SET, AND DELIBERATELY NOT IDENT_TYPES. Asking "does
// this handler touch its error binding" is not the same question as "what
// names appear in this condition". `catch (e) { send({ e: 1 }) }` holds a
// property_identifier spelled `e` that has nothing to do with the binding,
// and counting it would call that handler one that uses the failure.
export const BINDING_REF_TYPES = new Set(['identifier']);

// Calls this language spells as output that the shared trace vocabulary in
// ir.mjs does not already cover. `print` is NOT one of them here: in
// JavaScript it is a page instruction, not a log.
export const TRACE_NAMES = new Set();

export const BLOCK_TYPE = 'statement_block';

/** Where the condition of an `if` is kept. Dart keeps it by position instead. */
export const conditionOf = node => node.childForFieldName('condition');

/** How this language spells "hand the failure on". Dart spells it as an expression. */
export const RETHROW_TYPES = new Set(['throw_statement']);
export const isBlock = node => !!node && node.type === 'statement_block';

export const isCall = node => node.type === 'call_expression';

// ------------------------------------------------------------------- values
//
// The spellings of an ambiguous answer. What ambiguity MEANS is in values.mjs;
// this is only how JavaScript writes it.
export const AMBIGUOUS_LITERALS = new Map([
  ['[]', '[]'],
  ['{}', '{}'],
  ['null', 'null'],
  ['undefined', 'undefined'],
  ['0', '0'],
  ['-0', '0'],
  ['false', 'false'],
  ["''", "''"],
  ['""', "''"],
  ['``', "''"],
  ['newMap()', 'new Map()'],
  ['newSet()', 'new Set()'],
  ['newMap([])', 'new Map()'],
  ['newSet([])', 'new Set()'],
  ['Object.freeze([])', '[]'],
  ['Object.freeze({})', '{}'],
]);

export const UNWRAP_TYPES = new Set([
  'parenthesized_expression', 'as_expression', 'satisfies_expression',
  'non_null_expression', 'type_assertion', 'await_expression',
]);

export const OBJECT_LITERAL_TYPE = 'object';
export const CONSTRUCTION_TYPES = new Set(['array', 'new_expression']);

/** See values.mjs: matching the tail would make `logger.error(...)` a tagged answer. */
export const OUTCOME_TAIL = false;

export const valueKey = node => normaliseText(node.text);

/** Every JavaScript wrapper puts the value it wraps first. */
export const unwrapChild = node => node.namedChild(0);

// ------------------------------------------------------------- preconditions
//
// A GUARD ON AN ARGUMENT IS NOT AN EMPTY RESULT. `if (x == null) return null`
// answers a caller who asked a malformed question; it is not this function
// looking and finding nothing. Rule 4 collided the two and reported a collapse
// in functions that had carefully avoided one.
//
// Two halves decide it, and the first is the one that does the work: the
// condition may mention NOTHING but the function's own parameters. A test on a
// local or on a method of `this` is a statement about what the function found.

/** The names this function binds as parameters. */
export function parameterNames(fnNode) {
  const out = new Set();
  const p = fnNode.childForFieldName('parameters') || fnNode.childForFieldName('parameter');
  if (!p) return out;
  if (p.type === 'identifier') { out.add(p.text); return out; }
  const walk = node => {
    if (node.type === 'identifier' || node.type === 'shorthand_property_identifier_pattern')
      out.add(node.text);
    for (let i = 0; i < node.namedChildCount; i++) walk(node.namedChild(i));
  };
  walk(p);
  return out;
}

/** Names a precondition may mention besides the parameters themselves. */
export const PRECONDITION_NAMES = new Set(['length', 'trim']);

/**
 * Spellings of "this argument is absent", one operand at a time.
 * `x != null` is deliberately not here: that is a test for PRESENCE.
 */
export const ABSENCE_TESTS = [
  ['== null', /^\w+===?null$/],
  ['null ==', /^null===?\w+$/],
  ['== undefined', /^\w+===?undefined$/],
  ['falsy', /^!\w+$/],
  ['empty string', /^\w+===?(''|"")$/],
  ['length 0', /^\w+\.length===?0$/],
  ['no length', /^!\w+\.length$/],
  ['trimmed empty', /^\w+\.trim\(\)===?(''|"")$/],
];

/** `sb.from('x').select('y')` -> `sb.from.select`, with the arguments dropped. */
export function calleeText(callNode) {
  const f = callNode.childForFieldName('function');
  if (!f) return '';
  return normaliseText(f.text).replace(/\([^()]*\)/g, '').replace(/\[[^\]]*\]/g, '');
}

/** The head of a call chain: `sb.from('x').select('y')` -> `sb`. */
export function chainHead(callNode) {
  let n = callNode;
  for (let i = 0; n && i < 40; i++) {
    if (n.type === 'call_expression') { n = n.childForFieldName('function'); continue; }
    if (n.type === 'member_expression') { n = n.childForFieldName('object'); continue; }
    if (n.type === 'await_expression' || n.type === 'parenthesized_expression' ||
      n.type === 'non_null_expression') { n = n.namedChild(0); continue; }
    break;
  }
  return n ? n.text : '';
}

export function bodyOf(fnNode) {
  return fnNode.childForFieldName('body') || fnNode.namedChild(fnNode.namedChildCount - 1);
}

export function firstParam(fnNode) {
  const p = fnNode.childForFieldName('parameter') || fnNode.childForFieldName('parameters');
  if (!p) return null;
  if (p.type === 'identifier') return p;
  return p.namedChildCount ? p.namedChild(0) : null;
}

/** The text of an error binding. Strips a TypeScript type annotation. */
export const bindingText = param => normaliseText(param.text).replace(/:.*$/, '');

/**
 * An expression-bodied arrow (`() => []`) returns without a return statement.
 * @returns the expression, or null when the function has a real block.
 */
export function expressionBody(fnNode) {
  if (fnNode.type !== 'arrow_function') return null;
  const body = fnNode.childForFieldName('body');
  if (!body || body.type === 'statement_block') return null;
  return body;
}

/**
 * A readable name for a function, for the report and for the fingerprint.
 * An anonymous callback takes the name of what it was passed to, so
 * `.catch(function () { ... })` is reported as `catch callback of sb.rpc`
 * rather than as `<anonymous>` — which is not an identity anybody can look up.
 */
export function functionNameOf(node) {
  const own = node.childForFieldName ? node.childForFieldName('name') : null;
  if (own) return own.text;
  const p = node.parent;
  if (!p) return '<anonymous>';
  if (p.type === 'variable_declarator') {
    const n = p.childForFieldName('name');
    if (n) return n.text;
  }
  if (p.type === 'pair') {
    const k = p.childForFieldName('key');
    if (k) return k.text.replace(/['"`]/g, '');
  }
  if (p.type === 'assignment_expression') {
    const l = p.childForFieldName('left');
    if (l) return normaliseText(l.text);
  }
  if (p.type === 'arguments' && p.parent && p.parent.type === 'call_expression') {
    return calleeText(p.parent) + '()';
  }
  return '<anonymous>';
}

/**
 * A `catch` clause, or null.
 *
 * `guardedFrom`/`guardedTo` bound the source the handler stands over, so the
 * read it is handling can be found without re-walking the tree.
 */
export function catchSiteOf(node) {
  if (node.type !== 'catch_clause') return null;
  const body = node.childForFieldName('body') || node.namedChild(node.namedChildCount - 1);
  const tryStmt = node.parent;
  const tryBlock = tryStmt && tryStmt.type === 'try_statement'
    ? tryStmt.childForFieldName('body') : null;
  return {
    body,
    param: node.childForFieldName('parameter'),
    guardedFrom: tryBlock ? tryBlock.startIndex : node.startIndex,
    guardedTo: tryBlock ? tryBlock.endIndex : node.startIndex,
  };
}

/** `.catch(callback)`, or null. Not every language has a counterpart to promises. */
export function promiseCatchOf(node) {
  if (node.type !== 'call_expression') return null;
  const f = node.childForFieldName('function');
  if (!f || f.type !== 'member_expression') return null;
  const prop = f.childForFieldName('property');
  if (!prop || prop.text !== 'catch') return null;
  const args = node.childForFieldName('arguments');
  const cb = args && args.namedChildCount ? args.namedChild(0) : null;
  if (!cb || !FUNCTION_TYPES.has(cb.type)) return null;
  const receiver = f.childForFieldName('object');
  return {
    body: bodyOf(cb),
    param: firstParam(cb),
    guardedFrom: receiver ? receiver.startIndex : node.startIndex,
    guardedTo: receiver ? receiver.endIndex : node.startIndex,
    opNode: receiver,
  };
}

/**
 * A function with no normal path at all: everything a `.catch()` callback
 * returns is an answer to a failure.
 */
export function isFailureOnlyCallback(fnNode) {
  const p = fnNode.parent;
  return !!(p && p.type === 'arguments' && p.parent && p.parent.type === 'call_expression' &&
    /\.catch$/.test(calleeText(p.parent)));
}
