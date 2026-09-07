// Rule 4 — the failure path and the empty path end in the same expression.
//
// THE STRICTEST OF THE FOUR, and the only one where the defect is PROVED inside
// a single function before any neighbour is consulted:
//
//     async function loadDreams() {
//       try {
//         const { data, error } = await sb.from('dreams').select();
//         if (error) return [];        // <- failure
//         return data ?? [];           // <- no rows
//       } catch { return []; }         // <- failure
//     }
//
// Three exits, one answer. It is not that the caller ignores the difference —
// after this function there is no difference left to ignore. Rules 1 and 2 look
// at a handler and reason about what its caller can tell; this one shows the two
// paths meeting.
//
// WHY `data ?? []` COUNTS AS THE EMPTY PATH. The normal path almost never
// writes `return []` outright; it writes `return data ?? []`, and those are the
// same answer on the day the query comes back empty. Insisting on a literal
// match would leave the rule firing only on code simple enough not to need it.
// The unwrapping lives in ir.mjs (`potentialEmpty`) so that rules 2 and 4 agree
// about what an empty answer is.
//
// WHY A NESTED `.catch()` COUNTS AS THIS FUNCTION'S FAILURE PATH. `return
// sb.rpc('x').then(r => r.data ?? []).catch(() => [])` has its two paths in two
// different callbacks, and a reader would still call it one collapse. Only
// anonymous callbacks one level down are attributed; a named helper keeps its
// own failures, because its caller can be shown them separately.
//
// THE POPULATION IS THE SIBLING FUNCTIONS THAT DO DISTINGUISH. Where no sibling
// distinguishes, nothing is reported: a whole layer that answers the same way
// on both paths is a decision about that layer, and this tool reports deviation
// from your own code, not agreement with it.
import { t } from '../lang.mjs';
import { groupPeers, layerLabel } from '../layer.mjs';

export const id = 'same-answer';
export const needsPopulation = true;

const ANONYMOUS = /^(<anonymous>|.*\(\))$/;

/** The failure exits of a function, including those of its anonymous callbacks. */
function failureReturns(fn, byParent) {
  const own = fn.returns.filter(r => r.path === 'failure');
  const nested = (byParent.get(fn.id) || [])
    .filter(g => ANONYMOUS.test(g.name))
    .flatMap(g => g.returns.filter(r => r.path === 'failure'));
  return [...own, ...nested];
}

function normalReturns(fn) {
  return fn.returns.filter(r => r.path === 'normal');
}

/** The collision, or null: a value answered on both paths. */
function collision(fn, byParent) {
  const fails = failureReturns(fn, byParent).filter(r => r.kind === 'ambiguous');
  if (!fails.length) return null;
  const normals = normalReturns(fn).filter(r => r.potential);
  if (!normals.length) return null;
  for (const f of fails)
    for (const n of normals)
      if (n.potential === f.value)
        return { value: f.value, failureLine: f.line, emptyLine: n.line, emptyText: n.text };
  return null;
}

export function run(ir, ctx) {
  const byParent = new Map();
  for (const f of ir.functions) {
    if (!f.parent) continue;
    let a = byParent.get(f.parent);
    if (!a) { a = []; byParent.set(f.parent, a); }
    a.push(f);
  }

  // WHICH FUNCTIONS ARE COMPARABLE WITH WHICH.
  //
  // The first version grouped every function in a file together, and the group
  // was therefore always the largest of the four rules' — so rule 4 outscored
  // the others everywhere, by grouping rather than by evidence. Worse, it
  // quoted `formatDate` at the reader as a neighbour of a database read.
  //
  // The group is now the same one rules 2 and 3 use: functions doing the same
  // kind of work, named by the family of external read they perform. A function
  // that reads nothing outside the program is not in this tool's subject at all
  // and is neither reported nor counted.
  const familyOfFn = new Map();
  for (const r of ir.reads) {
    if (!r.fn) continue;
    let tally = familyOfFn.get(r.fn);
    if (!tally) { tally = new Map(); familyOfFn.set(r.fn, tally); }
    tally.set(r.family, (tally.get(r.family) || 0) + 1);
  }
  // A function that reads two kinds is filed under the commoner one; ties go to
  // the alphabetically first, so the grouping does not depend on read order.
  //
  // A CALLBACK INHERITS FROM THE CALL IT WAS PASSED TO. The read in
  // `sb.rpc('x').then(r => ...)` belongs to the enclosing function, not to the
  // callback — so on the first pass every `.then()` callback had no family and
  // dropped out, taking with it most of the sites where the two paths actually
  // meet. The family is looked up along the enclosing chain instead.
  const byId = new Map(ir.functions.map(f => [f.id, f]));
  const cache = new Map();
  const dominantFamily = fnId => {
    if (cache.has(fnId)) return cache.get(fnId);
    let answer = null;
    for (let id = fnId, hops = 0; id && hops < 12; hops++) {
      const tally = familyOfFn.get(id);
      if (tally) {
        answer = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
        break;
      }
      const f = byId.get(id);
      id = f ? f.parent : null;
    }
    cache.set(fnId, answer);
    return answer;
  };

  // Only functions that HAVE both paths are comparable. A function with no
  // failure exit is not doing this well — it simply is not in this contest, and
  // counting it as a well-behaved peer would inflate every conventionality
  // figure in the report.
  const candidates = ir.functions.filter(f =>
    dominantFamily(f.id) !== null &&
    failureReturns(f, byParent).length > 0 && normalReturns(f).length > 0);

  for (const f of candidates) f._collision = collision(f, byParent);

  const { peersOf } = groupPeers(candidates, {
    keyOf: f => dominantFamily(f.id),
    minpop: ctx.minpop,
    mode: ctx.layerMode,
  });

  const findings = [];
  const skipped = [];

  for (const fn of candidates) {
    const c = fn._collision;
    if (!c) continue;

    const peers = peersOf(fn);
    if (!peers || peers.tooFew) {
      skipped.push({
        rule: id, file: fn.file, line: fn.line,
        label: t('r4Label', fn.name, c.value),
        cause: 'too-few-peers',
        reason: t('tooFewPeers', peers ? peers.members.length : 0, ctx.minpop),
      });
      continue;
    }

    const safe = peers.members.filter(m => !m._collision);
    const odd = peers.members.filter(m => m._collision);
    if (safe.length === 0) {
      skipped.push({
        rule: id, file: fn.file, line: fn.line,
        label: t('r4Label', fn.name, c.value),
        cause: 'no-convention',
        reason: t('noConvention'),
      });
      continue;
    }

    findings.push({
      rule: id,
      file: fn.file,
      line: c.failureLine,
      anchor: fn.name + '=' + c.value,
      label: t('r4Label', fn.name, c.value),
      meta: {
        // The same unit key rules 1, 2 and 3 use, so one function breaking two
        // rules is ONE decision in the ranking rather than two lines of noise.
        unit: fn.name + '@' + peers.disc,
        peers: peers.members.length,
        safe: safe.length,
        odd: odd.length,
        conf: safe.length / peers.members.length,
        layer: peers.name,
        layerKind: peers.kind,
        family: peers.disc,
        value: c.value,
        emptyLine: c.emptyLine,
      },
      detail: {
        value: c.value,
        failureLine: c.failureLine,
        emptyLine: c.emptyLine,
        emptyText: c.emptyText,
        layerText: layerLabel(peers, t),
        neighbours: safe.slice(0, 4).map(m => ({
          file: m.file, line: m.line,
          note: m.name + ' — ' + t('nbDistinct'),
        })),
      },
    });
  }

  return { findings, skipped };
}
