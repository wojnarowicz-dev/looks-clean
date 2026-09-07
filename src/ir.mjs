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

const FUNCTION_TYPES = new Set([
  'function_declaration', 'function_expression', 'function',
  'generator_function', 'generator_function_declaration',
  'arrow_function', 'method_definition',
]);

const STATEMENT_TYPES = new Set([
  'expression_statement', 'lexical_declaration', 'variable_declaration',
  'return_statement', 'if_statement', 'for_statement', 'for_in_statement',
  'while_statement', 'do_statement', 'throw_statement', 'switch_statement',
  'try_statement', 'labeled_statement', 'public_field_definition',
]);

// A call that leaves a trace someone can find afterwards.
const TRACE_HEAD = /console\.|logger|Sentry|rollbar|bugsnag|datadog|winston|pino/i;
const TRACE_TAIL = /^(log|warn|error|info|debug|trace|logError|logWarn|report|reportError|capture|captureException|captureError|captureMessage|track|trackError|notify|toast|alert|showError|showMessage|showToast|displayError|emitError|onError|record|assert|fail)$/i;
const TRACE_SETTER = /^set[A-Z]?\w*(Error|Err|Failed|Failure|Problem|Warning|Status|Message)/;
const ERROR_NAME = /(^|_|\b)(err|error|exception|failure|failed)|((Err|Error|Exception|Failure)$)/i;

const rowOf = (node, off) => node.startPosition.row + 1 + off;

function walk(node, fn) {
  fn(node);
  for (let i = 0; i < node.childCount; i++) walk(node.child(i), fn);
}

/** The nearest enclosing statement, so a read can be judged with its context. */
function enclosingStatement(node) {
  let n = node;
  while (n && !STATEMENT_TYPES.has(n.type)) n = n.parent;
  return n || node;
}

/** The head of a call chain: `sb.from('x').select('y')` -> `sb`. */
function chainHead(callNode) {
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

/** `sb.from('x').select('y')` -> `sb.from.select`, with the arguments dropped. */
function calleeText(callNode) {
  const f = callNode.childForFieldName('function');
  if (!f) return '';
  return normaliseText(f.text).replace(/\([^()]*\)/g, '').replace(/\[[^\]]*\]/g, '');
}

/**
 * A readable name for a function, for the report and for the fingerprint.
 * An anonymous callback takes the name of what it was passed to, so
 * `.catch(function () { ... })` is reported as `catch callback of sb.rpc`
 * rather than as `<anonymous>` — which is not an identity anybody can look up.
 */
function functionName(node) {
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

/** The names an `if` condition tests for failure, or null when it tests nothing of the sort. */
function errorNamesInCondition(cond) {
  if (!cond) return null;
  const names = [];
  let sawNegatedOk = false;
  walk(cond, n => {
    if (n.type === 'identifier' || n.type === 'property_identifier' ||
      n.type === 'shorthand_property_identifier') {
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
 */
export function analyse(tree, file, off = 0) {
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
    if (FUNCTION_TYPES.has(node.type)) {
      const rec = {
        id: file + '#' + (nextId++),
        file,
        name: functionName(node),
        type: node.type,
        line: rowOf(node, off),
        endLine: node.endPosition.row + 1 + off,
        startIndex: node.startIndex,
        endIndex: node.endIndex,
        parent: enclosingFn() ? enclosingFn().id : null,
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
    if (node.type === 'call_expression') {
      const callee = calleeText(node);
      const fam = familyOf(callee, chainHead(node));
      if (fam) {
        const stmt = enclosingStatement(node);
        reads.push({
          file,
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
    if (node.type === 'catch_clause') {
      const param = node.childForFieldName('parameter');
      const body = node.childForFieldName('body') || node.namedChild(node.namedChildCount - 1);
      const tryStmt = node.parent;
      const tryBlock = tryStmt && tryStmt.type === 'try_statement'
        ? tryStmt.childForFieldName('body') : null;
      handlers.push(makeHandler({
        kind: 'catch',
        node, body, param, fn,
        guardedFrom: tryBlock ? tryBlock.startIndex : node.startIndex,
        guardedTo: tryBlock ? tryBlock.endIndex : node.startIndex,
        opNode: null,
      }));
    }

    // ---- .catch(callback)
    if (node.type === 'call_expression') {
      const f = node.childForFieldName('function');
      if (f && f.type === 'member_expression') {
        const prop = f.childForFieldName('property');
        if (prop && prop.text === 'catch') {
          const args = node.childForFieldName('arguments');
          const cb = args && args.namedChildCount ? args.namedChild(0) : null;
          if (cb && FUNCTION_TYPES.has(cb.type)) {
            const receiver = f.childForFieldName('object');
            handlers.push(makeHandler({
              kind: 'promise-catch',
              node, body: bodyOf(cb), param: firstParam(cb), fn,
              guardedFrom: receiver ? receiver.startIndex : node.startIndex,
              guardedTo: receiver ? receiver.endIndex : node.startIndex,
              opNode: receiver,
            }));
          }
        }
      }
    }

    // ---- if (error) { ... }
    if (node.type === 'if_statement') {
      const cond = node.childForFieldName('condition');
      const names = errorNamesInCondition(cond);
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

  function bodyOf(fnNode) {
    return fnNode.childForFieldName('body') || fnNode.namedChild(fnNode.namedChildCount - 1);
  }
  function firstParam(fnNode) {
    const p = fnNode.childForFieldName('parameter') || fnNode.childForFieldName('parameters');
    if (!p) return null;
    if (p.type === 'identifier') return p;
    return p.namedChildCount ? p.namedChild(0) : null;
  }

  // ------------------------------------------------------------ handlers
  function makeHandler({ kind, node, body, param, fn, guardedFrom, guardedTo, opNode, errorNames }) {
    const binding = param ? normaliseText(param.text).replace(/:.*$/, '') : null;
    const effects = handlerEffects(body, binding);
    return {
      file,
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
      if (STATEMENT_TYPES.has(n.type)) { e.statements++; e.empty = false; }
      if (n.type === 'identifier' && binding && n.text === binding) e.usesBinding = true;
      if (n.type === 'throw_statement') e.rethrows = true;
      if (n.type === 'call_expression') {
        const c = calleeText(n);
        const tail = c.split('.').pop();
        if (TRACE_HEAD.test(c) || TRACE_TAIL.test(tail) || TRACE_SETTER.test(tail)) e.logs = true;
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
    if (e.statements === 0 && body.type !== 'statement_block') e.empty = false;
    return e;
  }

  /** What the handler hands back: the value, and whether it names its own outcome. */
  function handlerAnswer(body, offset) {
    if (!body) return null;
    if (body.type !== 'statement_block') {
      const c = classify(body);
      return { ...c, line: rowOf(body, offset), text: normaliseText(unwrap(body).text).slice(0, 80) };
    }
    let found = null;
    walk(body, n => {
      if (found) return;
      if (n.type === 'return_statement') {
        const v = n.namedChildCount ? n.namedChild(0) : null;
        const c = classify(v);
        found = { ...c, line: rowOf(n, offset), text: v ? normaliseText(unwrap(v).text).slice(0, 80) : 'undefined' };
      }
    });
    if (found) return found;
    // No return at all: look for an assignment of an ambiguous value, which is
    // the same collapse written as a statement instead of an answer.
    walk(body, n => {
      if (found) return;
      if (n.type === 'assignment_expression') {
        const r = n.childForFieldName('right');
        const c = classify(r);
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
  function makeReturn(node, value, fn) {
    const c = classify(value);
    return {
      line: rowOf(node, off),
      path: pathOf(node, fn),
      kind: c.kind,
      value: c.value,
      potential: potentialEmpty(value),
      text: value ? normaliseText(unwrap(value).text).slice(0, 80) : 'undefined',
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
          errorNamesInCondition(n.childForFieldName('condition'))) return 'failure';
      }
      n = n.parent;
    }
    // A `.catch()` callback has no normal path at all: everything it returns is
    // an answer to a failure.
    if (fn) {
      const p = fn.node.parent;
      if (p && p.type === 'arguments' && p.parent && p.parent.type === 'call_expression' &&
        /\.catch$/.test(calleeText(p.parent))) return 'failure';
    }
    return 'normal';
  }

  function potentialEmpty(value) {
    if (!value) return 'undefined';
    const n = unwrap(value);
    const c = classify(n);
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
    if (fn.type !== 'arrow_function') continue;
    const body = fn.node.childForFieldName('body');
    if (!body || body.type === 'statement_block') continue;
    fn.returns.push(makeReturn(body, body, fn));
  }

  // ------------------------------------------------------------ handler families
  // Which read was this handler handling? Answered from the read list rather
  // than by re-walking, so a handler and a read can never disagree about what
  // family an operation belongs to.
  for (const h of handlers) {
    let candidates = [];
    if (h.guardedFrom !== null && h.guardedTo !== null) {
      candidates = reads.filter(r => r.startIndex >= h.guardedFrom && r.endIndex <= h.guardedTo);
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
