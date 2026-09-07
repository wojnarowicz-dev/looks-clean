// looks-clean — what an answer means.
//
// THE WHOLE TOOL TURNS ON ONE DISTINCTION: a value that says "there is nothing"
// and a value that says "I do not know". This module is where that distinction
// is made concrete, so the four rules can share one definition rather than each
// inventing its own.
//
// AMBIGUOUS values are the ones a healthy read also produces. `[]` is what a
// query for a user with no rows returns; `null` is what `maybeSingle()` returns
// for a missing row; `0` is what a counter of nothing holds; `false` is what a
// permission check answers for someone who does not have it. Handing one of
// these back from an error handler does not hide the failure — it renames it.
//
// TAGGED values carry their own provenance: `{ known: false, value: [] }`,
// `{ ok: false, error }`, `Err(e)`. The caller cannot read them without meeting
// the question "did this work". That is the whole of the fix this tool asks for,
// and it is why the tagged shape is recognised by STRUCTURE rather than by a
// list of blessed library names: what matters is that the outcome is in the
// value, not which helper put it there.

// The canonical spelling of each ambiguous value, used in reports and in the
// equality test for rule 4. Two sites that both answer `[]` must compare equal
// even when one wrote `[ ]` and the other `[]`.
const AMBIGUOUS_LITERALS = new Map([
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

/**
 * Keys that make an object literal self-describing. The list is deliberately
 * about the SHAPE of an answer — did it work, what went wrong — and not about
 * any particular library's naming.
 */
const OUTCOME_KEYS = new Set([
  'ok', 'known', 'success', 'succeeded', 'failed', 'failure', 'error', 'err',
  'errors', 'status', 'state', 'reason', 'code', 'kind', 'tag', 'type',
  'isError', 'hasError', 'isOk', 'loaded', 'ready', 'found', 'present',
  'exists', 'valid', 'complete', 'message',
]);

/** Constructor-shaped ways of returning an outcome. */
const OUTCOME_CALLS = /^(Err|Ok|Err\w*|Result\.\w+|Either\.\w+|Left|Right|failure|Failure|success|Success|error|Error)$/;

/** Strips whitespace so `[ ]` and `[]` compare equal, and drops a TS `as T`. */
export function normaliseText(s) {
  return String(s)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+/g, '');
}

/**
 * Unwraps the wrappers that do not change what a value MEANS:
 *   `[] as string[]`, `(<any>[])`, `([])`, `await []`.
 * Without this, a TypeScript file answering `[] as Dream[]` on one path and `[]`
 * on the other reads as two different answers, and rule 4 misses the collision
 * that a reader would spot at a glance.
 */
export function unwrap(node) {
  let n = node;
  for (let i = 0; n && i < 8; i++) {
    if (n.type === 'parenthesized_expression' ||
      n.type === 'as_expression' ||
      n.type === 'satisfies_expression' ||
      n.type === 'non_null_expression' ||
      n.type === 'type_assertion' ||
      n.type === 'await_expression') {
      const first = n.namedChild(0);
      if (!first) return n;
      n = first;
      continue;
    }
    return n;
  }
  return n;
}

/**
 * Classifies one returned/assigned expression.
 * @returns {{ kind: 'ambiguous'|'tagged'|'other', value: string|null }}
 */
export function classify(node) {
  if (!node) return { kind: 'ambiguous', value: 'undefined' };   // bare `return;`
  const n = unwrap(node);
  const text = normaliseText(n.text);

  const literal = AMBIGUOUS_LITERALS.get(text);
  if (literal) return { kind: 'ambiguous', value: literal };

  // An object literal is tagged when one of its keys names an outcome. An empty
  // object literal was caught above and is ambiguous, which is the right answer:
  // `{}` promises a shape and delivers none of it.
  if (n.type === 'object') {
    const keys = [];
    for (let i = 0; i < n.namedChildCount; i++) {
      const p = n.namedChild(i);
      const k = p.childForFieldName ? p.childForFieldName('key') : null;
      const name = k ? k.text.replace(/['"`]/g, '')
        : (p.type === 'shorthand_property_identifier' ? p.text : null);
      if (name) keys.push(name);
    }
    if (keys.some(k => OUTCOME_KEYS.has(k))) return { kind: 'tagged', value: null };
    return { kind: 'other', value: null };
  }

  if (n.type === 'call_expression') {
    const f = n.childForFieldName('function');
    if (f && OUTCOME_CALLS.test(normaliseText(f.text))) return { kind: 'tagged', value: null };
  }

  if (n.type === 'array' || n.type === 'new_expression') {
    // `[]` and `new Map()` were literals above; anything else is real content.
    return { kind: 'other', value: null };
  }

  return { kind: 'other', value: null };
}

/** Convenience: is this expression one of the ambiguous answers? */
export function isAmbiguous(node) {
  return classify(node).kind === 'ambiguous';
}
