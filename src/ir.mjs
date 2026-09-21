// looks-clean — one pass over a parsed file, producing the sites the rules read.
//
// THE RULES DO NOT WALK TREES. They read the four lists this module produces —
// functions, handlers, reads, returns — and compare members of those lists with
// each other. Keeping the walk in one place is not tidiness: a rule that walked
// its own tree would define "a read" or "an error handler" slightly differently
// from its neighbours, and the populations the rules compare against would stop
// being the same population. The comparison is the product here; the definitions
// underneath it have to be shared or it means nothing.
//
// LINE OFFSETS. Inline <script> in an HTML page is parsed as its own document,
// so every row here is shifted by the block's offset before it leaves this
// module. Reporting a line number that points into an excerpt nobody can open
// is a small lie that costs a lot of trust.
import { classify, normaliseText, unwrap } from './values.mjs';
import { familyOf, timeoutMarker } from './reads.mjs';

// WHICH NODE IS WHAT — this lived here and has moved to src/syntax/.
// This module asks the questions ("is this a call", "what does this clause
// handle"); one language's vocabulary answers them. While the answers were
// written in here, every one of them was spelled in JavaScript's node types,
// and another language got "no" to all of them — silently, as an empty result.

// A call that leaves a trace someone can find afterwards.
const TRACE_HEAD = /console\.|logger|Sentry|rollbar|bugsnag|datadog|winston|pino/i;
const TRACE_TAIL = /^(log|warn|error|info|debug|trace|logError|logWarn|report|reportError|capture|captureException|captureError|captureMessage|track|trackError|notify|toast|alert|showError|showMessage|showToast|displayError|emitError|onError|record|assert|fail)$/i;
const TRACE_SETTER = /^set[A-Z]?\w*(Error|Err|Failed|Failure|Problem|Warning|Status|Message)/;
const ERROR_NAME = /(^|_|\b)(err|error|exception|failure|failed)|((Err|Error|Exception|Failure)$)/i;

const rowOf = (node, off) => node.startPosition.row + 1 + off;

/** Strips the parentheses an `if` condition carries in both grammars. */
function unparenthesise(text) {
  let t = text;
  const balanced = s => {
    let d = 0;
    for (const c of s) { if (c === '(') d++; else if (c === ')') d--; if (d < 0) return false; }
    return d === 0;
  };
  while (t.startsWith('(') && t.endsWith(')') && balanced(t.slice(1, -1))) t = t.slice(1, -1);
  return t;
}

function walk(node, fn) {
  fn(node);
  for (let i = 0; i < node.childCount; i++) walk(node.child(i), fn);
}

/** The nearest enclosing statement, so a read can be judged with its context. */
function enclosingStatement(node, syn) {
  let n = node;
  while (n && !syn.STATEMENT_TYPES.has(n.type)) n = n.parent;
  return n || node;
}

/** The names an `if` condition tests for failure, or null when it tests nothing of the sort. */
function errorNamesInCondition(cond, syn) {
  if (!cond) return null;
  const names = [];
  let sawNegatedOk = false;
  walk(cond, n => {
    if (syn.IDENT_TYPES.has(n.type)) {
      if (ERROR_NAME.test(n.text)) names.push(n.text);
    }
  });
  const text = normaliseText(cond.text);
  if (/^!(\w+\.)*ok$|[!(]res(ponse)?\.ok|![\w.]*\.ok\b/.test(text) ||
    /\.status(Code)?[><]=?\s*\d/.test(text) || /!\w*\.?(success|succeeded)\b/.test(text))
    sawNegatedOk = true;
  if (!names.length && !sawNegatedOk) return null;
  return names.length ? [...new Set(names)] : ['<not ok>'];
}

/**
 * Everything the rules need out of one parsed document.
 *
 * @param tree   a tree-sitter tree
 * @param file   the path reported to the reader (already relative)
 * @param off    line offset, non-zero only for inline <script>
 * @param syn    the node vocabulary of this file's language, from src/syntax/
 *
 * `syn` HAS NO DEFAULT. A default would be one language chosen by silence, and
 * the whole of the previous commit's measurement was what that produces: a file
 * read through the wrong vocabulary parses, answers "no" to every question and
 * contributes nothing, which is indistinguishable from a file with nothing in it.
 */
export function analyse(tree, file, off = 0, syn) {
  if (!syn) throw new Error('analyse: no node vocabulary for ' + file);
  const root = tree.rootNode;
  const functions = [];
  const handlers = [];
  const reads = [];
  const byNode = new Map();          // function node id -> record

  // ------------------------------------------------------------ functions
  let nextId = 0;
  const fnStack = [];
  const enclosingFn = () => (fnStack.length ? fnStack[fnStack.length - 1] : null);

  const descend = (node) => {
    let pushed = false;
    if (syn.FUNCTION_TYPES.has(node.type)) {
      const rec = {
        id: file + '#' + (nextId++),
        file,
        name: syn.functionNameOf(node),
        type: node.type,
        line: rowOf(node, off),
        endLine: node.endPosition.row + 1 + off,
        startIndex: node.startIndex,
        endIndex: node.endIndex,
        parent: enclosingFn() ? enclosingFn().id : null,
        lang: syn.name,
        node,
        returns: [],
      };
      functions.push(rec);
      byNode.set(node.id, rec);
      fnStack.push(rec);
      pushed = true;
    }

    collectSite(node);

    for (let i = 0; i < node.childCount; i++) descend(node.child(i));
    if (pushed) fnStack.pop();
  };

  // ------------------------------------------------------------ one node
  function collectSite(node) {
    const fn = enclosingFn();

    // ---- reads
    if (syn.isCall(node)) {
      const callee = syn.calleeText(node);
      const fam = familyOf(callee, syn.chainHead(node), syn.name);
      if (fam) {
        const stmt = enclosingStatement(node, syn);
        reads.push({
          file,
          lang: syn.name,
          line: rowOf(node, off),
          callee,
          family: fam,
          fn: fn ? fn.id : null,
          fnName: fn ? fn.name : '<top level>',
          guard: timeoutMarker(stmt.text),
          startIndex: node.startIndex,
          endIndex: node.endIndex,
          stmtStart: stmt.startIndex,
          stmtEnd: stmt.endIndex,
        });
      }
    }

    // ---- catch clause
    {
      const site = syn.catchSiteOf(node);
      if (site) handlers.push(makeHandler({ kind: 'catch', node, fn, opNode: null, ...site }));
    }

    // ---- .catch(callback)
    {
      const site = syn.promiseCatchOf(node);
      if (site) handlers.push(makeHandler({ kind: 'promise-catch', node, fn, ...site }));
    }

    // ---- if (error) { ... }
    if (node.type === 'if_statement') {
      const cond = syn.conditionOf(node);
      const names = errorNamesInCondition(cond, syn);
      if (names) {
        const cons = node.childForFieldName('consequence');
        if (cons) {
          handlers.push(makeHandler({
            kind: 'error-branch',
            node, body: cons, param: null, fn,
            guardedFrom: null, guardedTo: null,
            opNode: null,
            errorNames: names,
          }));
        }
      }
    }

    // ---- returns
    if (fn && node.type === 'return_statement') {
      const value = node.namedChildCount ? node.namedChild(0) : null;
      fn.returns.push(makeReturn(node, value, fn));
    }
  }

  // ------------------------------------------------------------ handlers
  function makeHandler({ kind, node, body, param, fn, guardedFrom, guardedTo, opNode, errorNames }) {
    const binding = param ? syn.bindingText(param) : null;
    const effects = handlerEffects(body, binding);
    return {
      file,
      lang: syn.name,
      kind,
      line: rowOf(node, off),
      bodyLine: body ? rowOf(body, off) : rowOf(node, off),
      fn: fn ? fn.id : null,
      fnName: fn ? fn.name : '<top level>',
      binding,
      errorNames: errorNames || (binding ? [binding] : []),
      effects,
      answer: handlerAnswer(body, off),
      startIndex: node.startIndex,
      endIndex: node.endIndex,
      guardedFrom,
      guardedTo,
      opText: opNode ? normaliseText(opNode.text).slice(0, 120) : null,
      snippet: snippetOf(body || node),
      family: null,       // filled in below, once every read is known
      opLabel: null,
    };
  }

  /**
   * WHAT COUNTS AS LEAVING A TRACE.
   *
   * Not "does it contain a console.log". The criterion that survived contact
   * with real code is: DOES THE HANDLER USE THE FAILURE AT ALL. A handler that
   * never touches its own error binding, throws nothing, logs nothing and
   * assigns to nothing error-shaped has, by construction, discarded the only
   * evidence that anything went wrong.
   *
   * The alternative — a list of approved logging calls — was tried first and
   * was wrong in both directions on the first real file it met. It called a
   * handler that recorded the reason into a local variable a swallower, because
   * the variable was not named `error`; and it would have passed any handler
   * that logged and then returned the ambiguous value anyway.
   */
  function handlerEffects(body, binding) {
    const e = {
      usesBinding: false, logs: false, rethrows: false,
      assignsErrorTarget: false, statements: 0, empty: true,
    };
    if (!body) return e;

    walk(body, n => {
      if (n.type === 'comment') return;
      if (syn.STATEMENT_TYPES.has(n.type)) { e.statements++; e.empty = false; }
      if (syn.BINDING_REF_TYPES.has(n.type) && binding && n.text === binding) e.usesBinding = true;
      if (syn.RETHROW_TYPES.has(n.type)) e.rethrows = true;
      if (syn.isCall(n)) {
        const c = syn.calleeText(n);
        const tail = c.split('.').pop();
        if (TRACE_HEAD.test(c) || TRACE_TAIL.test(tail) || TRACE_SETTER.test(tail) ||
          syn.TRACE_NAMES.has(tail)) e.logs = true;
        if (/^(Promise\.reject|reject)$/.test(c)) e.rethrows = true;
      }
      if (n.type === 'assignment_expression') {
        const l = n.childForFieldName('left');
        if (l && ERROR_NAME.test(normaliseText(l.text))) e.assignsErrorTarget = true;
      }
    });

    // An expression-bodied arrow (`() => []`) has no statement node at all, and
    // counting it as empty would report every one of them under rule 1 — which
    // is rule 2's business, not rule 1's.
    if (e.statements === 0 && !syn.isBlock(body)) e.empty = false;
    return e;
  }

  /** What the handler hands back: the value, and whether it names its own outcome. */
  function handlerAnswer(body, offset) {
    if (!body) return null;
    if (!syn.isBlock(body)) {
      const c = classify(body, syn);
      return { ...c, line: rowOf(body, offset), text: normaliseText(unwrap(body, syn).text).slice(0, 80) };
    }
    let found = null;
    walk(body, n => {
      if (found) return;
      if (n.type === 'return_statement') {
        const v = n.namedChildCount ? n.namedChild(0) : null;
        const c = classify(v, syn);
        found = { ...c, line: rowOf(n, offset), text: v ? normaliseText(unwrap(v, syn).text).slice(0, 80) : 'undefined' };
      }
    });
    if (found) return found;
    // No return at all: look for an assignment of an ambiguous value, which is
    // the same collapse written as a statement instead of an answer.
    walk(body, n => {
      if (found) return;
      if (n.type === 'assignment_expression') {
        const r = n.childForFieldName('right');
        const c = classify(r, syn);
        if (c.kind === 'ambiguous') {
          const l = n.childForFieldName('left');
          found = {
            ...c, line: rowOf(n, offset),
            text: (l ? normaliseText(l.text) + ' = ' : '') + c.value,
            assigned: true,
          };
        }
      }
    });
    return found;
  }

  function snippetOf(node) {
    return String(node.text).replace(/\s+/g, ' ').trim().slice(0, 100);
  }

  // ------------------------------------------------------------ returns
  /**
   * A return is on the FAILURE path when it sits inside a catch clause, inside
   * the taken branch of an error test, or inside a `.catch()` callback. It is on
   * the NORMAL path otherwise.
   *
   * `potentialEmpty` is the second half of rule 4 and the reason it works on
   * real code. The normal path rarely writes `return []`; it writes
   * `return data ?? []`. Those are the same answer whenever the query came back
   * empty, and refusing to see that would leave the rule firing only on code
   * simple enough not to need it.
   */
  /**
   * A RETURN THAT ANSWERS A MALFORMED QUESTION, not an empty result.
   *
   * `if (mediaSourcesTxt == null) return null` has not looked at anything yet,
   * so it cannot be the path where this function looked and found nothing. Rule
   * 4 collided it with a catch answering the same null and reported a collapse
   * in methods whose javadoc documented the deliberate split it was accusing
   * them of losing. Five of the six false alarms in the first sample of
   * test/precision.json are this one shape.
   *
   * THE CONDITION MUST MENTION NOTHING BUT PARAMETERS, and that half is what
   * does the work. `if (resumePath == null)` on a local read out of a config is
   * a statement about what this function found, and stays an empty path.
   */
  function isPrecondition(node, fn) {
    if (!fn) return false;
    if (fn.params === undefined) fn.params = syn.parameterNames(fn.node);
    if (!fn.params.size) return false;

    let n = node.parent;
    let cond = null;
    while (n && n !== fn.node) {
      if (n.type === 'if_statement') {
        const cons = n.childForFieldName('consequence');
        if (cons && node.startIndex >= cons.startIndex && node.endIndex <= cons.endIndex) {
          cond = syn.conditionOf(n);
          break;
        }
      }
      n = n.parent;
    }
    if (!cond) return false;

    let onlyParams = true;
    walk(cond, x => {
      if (!onlyParams || !syn.IDENT_TYPES.has(x.type)) return;
      if (!fn.params.has(x.text) && !syn.PRECONDITION_NAMES.has(x.text)) onlyParams = false;
    });
    if (!onlyParams) return false;

    return unparenthesise(normaliseText(cond.text)).split('||')
      .every(operand => syn.ABSENCE_TESTS.some(([, re]) => re.test(operand)));
  }

  function makeReturn(node, value, fn) {
    const c = classify(value, syn);
    return {
      line: rowOf(node, off),
      path: pathOf(node, fn),
      guard: isPrecondition(node, fn),
      kind: c.kind,
      value: c.value,
      potential: potentialEmpty(value),
      text: value ? normaliseText(unwrap(value, syn).text).slice(0, 80) : 'undefined',
    };
  }

  function pathOf(node, fn) {
    let n = node.parent;
    const stop = fn ? fn.node : root;
    while (n && n !== stop) {
      if (n.type === 'catch_clause') return 'failure';
      if (n.type === 'if_statement') {
        const cons = n.childForFieldName('consequence');
        if (cons && node.startIndex >= cons.startIndex && node.endIndex <= cons.endIndex &&
          errorNamesInCondition(syn.conditionOf(n), syn)) return 'failure';
      }
      n = n.parent;
    }
    // A `.catch()` callback has no normal path at all: everything it returns is
    // an answer to a failure.
    if (fn && syn.isFailureOnlyCallback(fn.node)) return 'failure';
    return 'normal';
  }

  function potentialEmpty(value) {
    if (!value) return 'undefined';
    const n = unwrap(value, syn);
    const c = classify(n, syn);
    if (c.kind === 'ambiguous') return c.value;
    if (n.type === 'binary_expression') {
      const op = n.childForFieldName('operator');
      const opText = op ? op.text : (n.child(1) ? n.child(1).text : '');
      if (opText === '??' || opText === '||') {
        const right = n.childForFieldName('right');
        return right ? potentialEmpty(right) : null;
      }
    }
    if (n.type === 'ternary_expression') {
      const a = n.childForFieldName('consequence');
      const b = n.childForFieldName('alternative');
      return (a ? potentialEmpty(a) : null) || (b ? potentialEmpty(b) : null);
    }
    return null;
  }

  descend(root);

  // ------------------------------------------------------------ arrow bodies
  // An expression-bodied arrow returns without a return_statement. Adding it
  // here rather than in the walk keeps `descend` about structure only.
  for (const fn of functions) {
    const body = syn.expressionBody(fn.node);
    if (!body) continue;
    fn.returns.push(makeReturn(body, body, fn));
  }

  // A FUNCTION THAT ANSWERS NOTHING CANNOT ANSWER THE SAME THING TWICE. Every
  // return of a void method is `undefined`, so its failure path and its empty
  // path are identical by construction and saying so is vacuous. Rule 4
  // reported two of them; one really is a defect, and rule 1 is the rule that
  // can say so.
  for (const fn of functions)
    fn.answerless = fn.returns.length > 0 && fn.returns.every(r => r.text === 'undefined');

  // ------------------------------------------------------------ handler families
  // Which read was this handler handling? Answered from the read list rather
  // than by re-walking, so a handler and a read can never disagree about what
  // family an operation belongs to.
  //
  // A READ UNDER ITS OWN HANDLER DOES NOT REACH THIS ONE. The failure of a call
  // wrapped in a nested try never arrives at the outer catch, so it is not the
  // operation the outer catch is standing over — and because it is nested it is
  // also the LAST read in source order, so it won the label every time.
  //
  // Measured on the defect this was found with. A method opens a directory
  // stream in a try-with-resources and, inside the stream, reads each entry's
  // attributes in a try of its own. The report named the handler after the
  // inner read, whose IOException it never sees, and told the reader to go and
  // look at the wrong call. Both are `fs`, so nothing moved except the sentence
  // the reader is asked to act on — which is the part of a finding that has to
  // be true before any of the rest is worth anything.
  //
  // Containment is STRICT, because Java writes two catch clauses over one try
  // and neither of them shields the other.
  const shields = handlers.filter(x => x.guardedFrom !== null && x.guardedTo !== null);
  const shielded = (h, r) => shields.some(s =>
    s !== h &&
    s.guardedFrom >= h.guardedFrom && s.guardedTo <= h.guardedTo &&
    (s.guardedFrom > h.guardedFrom || s.guardedTo < h.guardedTo) &&
    r.startIndex >= s.guardedFrom && r.endIndex <= s.guardedTo);

  for (const h of handlers) {
    let candidates = [];
    if (h.guardedFrom !== null && h.guardedTo !== null) {
      candidates = reads.filter(r =>
        r.startIndex >= h.guardedFrom && r.endIndex <= h.guardedTo && !shielded(h, r));
    } else if (h.kind === 'error-branch' && h.fn) {
      // The error name was destructured out of a read a few lines above. Find
      // the read whose own statement introduced it.
      candidates = reads.filter(r =>
        r.fn === h.fn && r.startIndex < h.startIndex &&
        h.errorNames.some(nm => nm !== '<not ok>' && sourceBetween(r.stmtStart, r.stmtEnd).includes(nm)));
      candidates = candidates.slice(-1);
    }
    if (candidates.length) {
      h.family = candidates[candidates.length - 1].family;
      h.opLabel = candidates[candidates.length - 1].callee;
    }
  }

  function sourceBetween(a, b) {
    return root.text.slice(a - root.startIndex, b - root.startIndex);
  }

  return {
    file,
    functions,
    handlers,
    reads,
    hasParseError: root.hasError,
  };
}
