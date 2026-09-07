// Rule 2 — a handler that answers with a value that already means "no data".
//
// THE DEFECT. `sb.rpc('my_reviews').catch(() => [])` does not hide the failure
// so much as rename it. `[]` is exactly what the same call returns for an
// account with no reviews, so the screen shows "you have no reviews" to somebody
// who has two. The counter beside it shows a real zero, so the picture is
// consistent and false at once — which is why nobody files a bug about it.
//
// WHY A POPULATION IS REQUIRED. "Never return a default from a catch" is not a
// rule anybody can follow: an empty list on failure is a perfectly good answer
// in plenty of places, and a tool that says otherwise is switched off within a
// day. What is NOT defensible is doing it here while the three calls beside it,
// in the same block, against the same backend, all carry their outcome with the
// value. That is not a style preference — it is one of the four that somebody
// forgot, and the other three are the proof.
//
// THE CONVENTION MUST EXIST BEFORE IT CAN BE BROKEN. When no neighbour carries
// its outcome, nothing is reported. That is a deliberate silence, and it is
// counted and named in the run header, because an uncounted silence here would
// be the tool committing its own subject matter.
import { t } from '../lang.mjs';
import { groupPeers, layerLabel } from '../layer.mjs';

export const id = 'default-on-error';
export const needsPopulation = true;

// WHAT COUNTS AS DISTINGUISHING. Anything whose answer a caller can tell apart
// from the empty result: a rethrow, a tagged outcome, or simply a value that is
// not one of the ambiguous ones.
//
// The first version required the answer to be TAGGED, and that was too narrow in
// a way that cost a whole known answer. The delete-account edge function ends its
// error branches with `return jsonResponse({ error: 'DELETE_FAILED' }, 500)` —
// about as distinguishable as an answer gets — but `jsonResponse(...)` is not an
// object literal and not on any list of blessed constructors, so it counted as
// neither safe nor deviant. The one branch that really did collapse to `[]` was
// then left with a population of one and passed over in silence.
//
// The question this rule asks is not "did you use a Result type". It is "can the
// caller tell". Anything that is not the ambiguous value can.
const distinguishes = h =>
  h.effects.rethrows || (h.answer && h.answer.kind !== 'ambiguous');

const collapses = h => h.answer && h.answer.kind === 'ambiguous';

export function run(ir, ctx) {
  // Only handlers over an external operation. The ambiguity between "none" and
  // "could not check" is only interesting where "could not check" is a state
  // that actually happens.
  const candidates = ir.handlers.filter(h => h.family !== null && (distinguishes(h) || collapses(h)));

  const { peersOf } = groupPeers(candidates, {
    keyOf: h => h.family,
    minpop: ctx.minpop,
    mode: ctx.layerMode,
  });

  const findings = [];
  const skipped = [];

  for (const h of candidates) {
    if (!collapses(h)) continue;

    const peers = peersOf(h);
    if (!peers || peers.tooFew) {
      skipped.push({
        rule: id, file: h.file, line: h.line,
        label: t('r2Label', h.opLabel || h.fnName, h.answer.value),
        cause: 'too-few-peers',
        reason: t('tooFewPeers', peers ? peers.members.length : 0, ctx.minpop),
      });
      continue;
    }

    const safe = peers.members.filter(distinguishes);
    const odd = peers.members.filter(collapses);
    if (safe.length === 0) {
      skipped.push({
        rule: id, file: h.file, line: h.line,
        label: t('r2Label', h.opLabel || h.fnName, h.answer.value),
        cause: 'no-convention',
        reason: t('noConvention'),
      });
      continue;
    }

    const where = h.opLabel || h.fnName;
    findings.push({
      rule: id,
      file: h.file,
      line: h.answer.line || h.line,
      anchor: where + '->' + h.answer.value,
      label: t('r2Label', where, h.answer.value),
      meta: {
        unit: h.fnName + '@' + h.family,
        peers: peers.members.length,
        safe: safe.length,
        odd: odd.length,
        conf: safe.length / peers.members.length,
        layer: peers.name,
        layerKind: peers.kind,
        family: h.family,
        value: h.answer.value,
        handler: h.kind,
      },
      detail: {
        snippet: h.snippet,
        value: h.answer.value,
        layerText: layerLabel(peers, t),
        neighbours: safe.slice(0, 4).map(m => ({
          file: m.file, line: m.line,
          note: (m.opLabel || m.fnName) + ' — ' +
            (m.effects.rethrows ? t('nbRethrowsInstead')
              : m.answer && m.answer.kind === 'tagged' ? t('nbTagged')
                : t('nbDistinctValue', m.answer ? m.answer.text : '')),
        })),
      },
    });
  }

  return { findings, skipped };
}
