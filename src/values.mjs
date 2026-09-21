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
//
// THE MEANING IS HERE; THE SPELLING IS IN src/syntax/.
//
// `[]` and `new ArrayList<>()` are the same answer to a caller and are written
// nowhere alike, so the list of literals belongs to a language and the question
// "is this ambiguous" belongs here. Keeping the spellings in this file would
// have meant one map holding two languages, where a Java entry could be matched
// against a JavaScript file — and the only visible effect of a wrong match is a
// finding that should not be there, or a population quietly short of a member.

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

/** Strips whitespace so `[ ]` and `[]` compare equal, and drops comments. */
export function normaliseText(s) {
  return String(s)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+/g, '');
}

/**
 * Unwraps the wrappers that do not change what a value MEANS:
 *   `[] as string[]`, `(<any>[])`, `([])`, `await []`, `(List<File>) null`.
 * Without this, a TypeScript file answering `[] as Dream[]` on one path and `[]`
 * on the other reads as two different answers, and rule 4 misses the collision
 * that a reader would spot at a glance.
 */
export function unwrap(node, syn) {
  let n = node;
  for (let i = 0; n && i < 8; i++) {
    if (syn.UNWRAP_TYPES.has(n.type)) {
      // WHICH CHILD CARRIES THE VALUE IS A FACT ABOUT THE GRAMMAR. Taking the
      // first named child is right in JavaScript and wrong in Java, where
      // `(List<File>) null` is a cast whose first named child is the type — so
      // the answer came back as `List<File>`, classified as content, and a
      // handler collapsing to null stopped being one.
      const inner = syn.unwrapChild(n);
      if (!inner) return n;
      n = inner;
      continue;
    }
    return n;
  }
  return n;
}

/**
 * Classifies one returned/assigned expression.
 * @param node the expression, or null for a bare `return;`
 * @param syn  the node vocabulary of the file's language, from src/syntax/
 * @returns {{ kind: 'ambiguous'|'tagged'|'other', value: string|null }}
 */
export function classify(node, syn) {
  if (!node) return { kind: 'ambiguous', value: 'undefined' };   // bare `return;`
  const n = unwrap(node, syn);
  const text = syn.valueKey(n);

  const literal = syn.AMBIGUOUS_LITERALS.get(text);
  if (literal) return { kind: 'ambiguous', value: literal };

  // An object literal is tagged when one of its keys names an outcome. An empty
  // object literal was caught above and is ambiguous, which is the right answer:
  // `{}` promises a shape and delivers none of it.
  if (syn.OBJECT_LITERAL_TYPE && n.type === syn.OBJECT_LITERAL_TYPE) {
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

  if (syn.isCall(n)) {
    const callee = syn.calleeText(n);
    if (OUTCOME_CALLS.test(callee)) return { kind: 'tagged', value: null };
    // WHERE THE TYPE NAME COMES FIRST, THE TAIL IS THE OUTCOME. Java spells the
    // same idea as `ProjectOpResult.ok(x)` or `new ProjectOpResult.Ok(x)`, so
    // the segment that names the outcome is the last one, not the whole callee.
    // JavaScript does NOT get this: there `logger.error(...)` would read as a
    // tagged answer, and a well-behaved handler would stop counting as one.
    if (syn.OUTCOME_TAIL && OUTCOME_CALLS.test(callee.split('.').pop()))
      return { kind: 'tagged', value: null };
  }

  // `[]`, `new Map()` and `new ArrayList<>()` were literals above; anything else
  // built the same way is real content.
  if (syn.CONSTRUCTION_TYPES.has(n.type)) return { kind: 'other', value: null };

  return { kind: 'other', value: null };
}

/** Convenience: is this expression one of the ambiguous answers? */
export function isAmbiguous(node, syn) {
  return classify(node, syn).kind === 'ambiguous';
}
