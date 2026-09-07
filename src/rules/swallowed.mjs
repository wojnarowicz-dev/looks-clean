// Rule 1 — a handler that swallows the failure and leaves no trace.
//
// THIS IS THE WEAKEST OF THE FOUR, DELIBERATELY, AND IT IS NOT THE HEADLINE.
// eslint (no-empty), the Dart analyzer (empty_catches) and the C# analyzer
// (AL0115) already report an empty catch, and they report it without needing to
// read the rest of the project. Anything this rule finds on its own, a linter
// the reader already runs finds too.
//
// It earns its place here for two reasons and no others:
//
//   1. WHEN THERE ARE NEIGHBOURS, it stops being a rule and becomes a
//      comparison: "9 of the 11 handlers in this file record what happened;
//      these 2 do not". That sentence is not in any linter's vocabulary,
//      because a linter has no population.
//   2. It supplies the OTHER rules' evidence. A handler that swallows AND
//      answers `[]` is one site breaking two rules, and the ranking merges them
//      into one decision rather than two lines of noise.
//
// WHAT COUNTS AS A TRACE is defined in ir.mjs, and the definition matters more
// than the rule: a handler leaves a trace when it USES THE FAILURE at all —
// touches its own error binding, rethrows, logs, or writes to something
// error-shaped. A list of approved logging calls was tried first and was wrong
// in both directions on the first real file it met.
import { t } from '../lang.mjs';
import { groupPeers, layerLabel } from '../layer.mjs';

export const id = 'swallowed';
export const needsPopulation = false;

// A TAGGED ANSWER IS A TRACE IN THE INTERFACE, and leaving it out was wrong.
// A handler shaped `.catch(() => ({ known: false, value: null }))` logs nothing
// and never touches its binding, so the first version of this rule reported
// every well-behaved handler in the project as a swallower — including the very
// neighbours rule 2 quotes back to the reader as the convention. The rule is
// "no log AND no trace in the interface"; handing the outcome to the caller is
// that trace, and it is the better one.
const leavesTrace = h =>
  h.effects.usesBinding || h.effects.logs || h.effects.rethrows ||
  h.effects.assignsErrorTarget || (h.answer && h.answer.kind === 'tagged');

export function run(ir, ctx) {
  // Only handlers standing over something that can fail for reasons outside
  // this program, plus genuinely empty ones. A swallowed failure of the
  // program's own arithmetic is a linter's business; a swallowed failure of the
  // network is this tool's.
  const candidates = ir.handlers.filter(h => h.family !== null || h.effects.empty);

  const { peersOf } = groupPeers(candidates, {
    // Grouped by family, the same way rules 2, 3 and 4 group. A file-wide
    // group of 'all handlers' is coarser evidence about any one site, and a
    // coarser group is a larger population, which the score would read as a
    // STRONGER claim. Same notion of 'the same kind of work' everywhere.
    keyOf: h => h.family || 'none',
    minpop: ctx.minpop,
    mode: ctx.layerMode,
  });

  const findings = [];
  const skipped = [];

  for (const h of candidates) {
    if (leavesTrace(h)) continue;

    const peers = peersOf(h);
    const speaking = peers ? peers.members.filter(leavesTrace) : [];
    const silent = peers ? peers.members.filter(m => !leavesTrace(m)) : [];

    // A population exists only when somebody in the layer does it the other way.
    // Without that, this is a plain observation and is scored as one.
    const hasPopulation = peers && !peers.tooFew && speaking.length > 0;

    const where = h.opLabel ? h.opLabel : h.fnName;
    const anchor = [h.fnName, h.kind, h.opLabel || ''].join('/');

    findings.push({
      rule: id,
      file: h.file,
      line: h.line,
      anchor,
      label: t('r1Label', where),
      meta: {
        unit: h.fnName + '@' + (h.family || 'none'),
        peers: hasPopulation ? peers.members.length : 0,
        safe: hasPopulation ? speaking.length : 0,
        odd: hasPopulation ? silent.length : 1,
        conf: hasPopulation ? speaking.length / peers.members.length : undefined,
        layer: hasPopulation ? peers.name : null,
        layerKind: hasPopulation ? peers.kind : null,
        family: h.family,
        handler: h.kind,
      },
      detail: {
        snippet: h.snippet,
        alone: !hasPopulation,
        layerText: hasPopulation ? layerLabel(peers, t) : null,
        neighbours: hasPopulation
          ? speaking.slice(0, 3).map(m => ({
            file: m.file, line: m.line,
            note: (m.opLabel || m.fnName) + ' — ' +
              (m.effects.rethrows ? t('nbRethrows') : m.effects.logs ? t('nbLogs') : t('nbUsesError')),
          }))
          : [],
      },
    });
  }

  return { findings, skipped };
}
