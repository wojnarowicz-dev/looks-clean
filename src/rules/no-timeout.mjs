// Rule 3 — a read with no time limit, standing next to reads that have one.
//
// THIS IS THE RULE THE TOOL WAS NAMED FOR. A read that never returns is not an
// error anywhere in the program: no catch runs, no branch is taken, nothing is
// logged, no counter moves. The screen keeps whatever it already had — an empty
// list under a spinner — and stays that way. Every other rule here catches a
// failure that was handled badly; this one catches a failure that was never
// handled because it never arrived.
//
// AND IT IS THE ONE NO LINTER CAN STATE. "Every fetch needs a timeout" is
// either ignored or, worse, obeyed with a number pulled out of the air. The
// sentence worth saying is the comparative one:
//
//     saveDream has a time limit, saveProfile does not, and they are the same layer.
//
// That claim can only be made by a tool that has read the rest of the project,
// and it comes with its own fix: whatever limit the neighbours use.
//
// WHY GROUPING IS BY FAMILY. `fetch` and `supabase.rpc` are not comparable: a
// project may reasonably put its own deadline on one and rely on the client's
// for the other. Two supabase calls in one file, one with a deadline and one
// without, is a real inconsistency. Grouping by exact callee text instead would
// leave every group with one member, and the rule would find nothing while
// saying nothing — which is the failure this whole tool is named after.
import { t } from '../lang.mjs';
import { groupPeers, layerLabel } from '../layer.mjs';

export const id = 'no-timeout';
export const needsPopulation = true;

export function run(ir, ctx) {
  // `parse` and `storage` are excluded: JSON.parse and localStorage.getItem are
  // synchronous and cannot hang, so a "missing timeout" on them would be a
  // finding about nothing. Keeping them in would inflate every population they
  // touched and weaken the real ones.
  const candidates = ir.reads.filter(r => r.family !== 'parse' && r.family !== 'storage');

  const { peersOf } = groupPeers(candidates, {
    keyOf: r => r.family,
    minpop: ctx.minpop,
    mode: ctx.layerMode,
  });

  const findings = [];
  const skipped = [];

  for (const r of candidates) {
    if (r.guard) continue;

    const peers = peersOf(r);
    if (!peers || peers.tooFew) {
      skipped.push({
        rule: id, file: r.file, line: r.line,
        label: t('r3Label', r.fnName, r.callee),
        cause: 'too-few-peers',
        reason: t('tooFewPeers', peers ? peers.members.length : 0, ctx.minpop),
      });
      continue;
    }

    const guarded = peers.members.filter(m => m.guard);
    const bare = peers.members.filter(m => !m.guard);
    if (guarded.length === 0) {
      // Nobody in this layer sets a deadline. That is a decision about the
      // layer, not a deviation inside it, and this tool does not have an
      // opinion about it. Counted and shown under --verbose, never as a finding.
      skipped.push({
        rule: id, file: r.file, line: r.line,
        label: t('r3Label', r.fnName, r.callee),
        cause: 'no-convention',
        reason: t('noConvention'),
      });
      continue;
    }

    // The fix names the mechanism the neighbours already use, not a mechanism
    // in general. The commonest one wins, so the advice matches the file.
    const tally = new Map();
    for (const g of guarded) tally.set(g.guard, (tally.get(g.guard) || 0) + 1);
    const preferred = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];

    findings.push({
      rule: id,
      file: r.file,
      line: r.line,
      anchor: r.callee + '@' + r.fnName,
      label: t('r3Label', r.fnName, r.callee),
      meta: {
        unit: r.fnName + '@' + r.family,
        peers: peers.members.length,
        safe: guarded.length,
        odd: bare.length,
        conf: guarded.length / peers.members.length,
        layer: peers.name,
        layerKind: peers.kind,
        family: r.family,
        guard: preferred,
      },
      detail: {
        callee: r.callee,
        guard: preferred,
        layerText: layerLabel(peers, t),
        neighbours: guarded.slice(0, 4).map(m => ({
          file: m.file, line: m.line,
          note: m.fnName + ' — ' + m.guard,
        })),
      },
    });
  }

  return { findings, skipped };
}
