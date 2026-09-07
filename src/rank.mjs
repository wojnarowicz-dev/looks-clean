// looks-clean — one ranking across rules and across saved runs.
//
// WHY. Four rules produce four lists on four different scales. A person has no
// way to compare "this catch is empty" with "9 of 11 reads in this file have a
// timeout and this one does not", and does not know what to read first. The
// ranking reduces them to one number built from explicit components.
//
// COMPONENTS. Every finding carries the same three quantities in `meta`,
// whichever rule produced it:
//   conventionality — how strongly the convention holds in the layer (0..1)
//   population      — how many neighbours it rests on (saturates at 10)
//   rarity          — the fewer sites deviate, the stronger the signal (1/odd)
//
// MULTIPLICATION, NOT A SUM. A finding should rank high only when ALL THREE are
// high: a strong convention over three examples means nothing, and neither does
// a large population with half the sites deviating. A sum lets one high
// component mask a zero one; a product does not.
//
// WHERE RULE 1 LANDS. Mostly by arithmetic: a swallowed catch with no
// neighbour comparison has no population at all, so its population component is
// the floor below and it cannot outscore a measured deviation. Where the
// arithmetic ties, one explicit weight settles it — see RULE_WEIGHT.
import { t } from './lang.mjs';

// The floor for a finding that rests on no population. Not zero: zero would
// make every such finding score 0 and lose the ordering among them entirely,
// which is a different kind of "all the same" from the one this tool hunts.
const NO_POPULATION_FLOOR = 0.1;

export function components(meta = {}) {
  const m = meta || {};
  const odd = Number(m.odd ?? 1) || 1;
  const peers = Number(m.peers ?? 0) || 0;
  const safe = Number(m.safe ?? 0) || 0;

  let conventionality = m.conf !== undefined ? Number(m.conf)
    : peers > 0 ? safe / peers
      : 0.5;
  if (Number.isNaN(conventionality)) conventionality = 0.5;

  const population = peers > 0 ? Math.min(1, peers / 10) : NO_POPULATION_FLOOR;
  const rarity = 1 / odd;

  return { conventionality, population, rarity, odd, peers, safe };
}

// RULE 1 IS SCORED AT HALF, and this is the one thumb on the scale in the whole
// tool, so it is written down rather than buried.
//
// `swallowed` is the only one of the four that a linter the reader already runs
// will also report — eslint no-empty, Dart empty_catches, C# AL0115. Its
// findings are therefore worth less to that reader than a measured deviation
// they can get nowhere else, even when the arithmetic comes out the same.
//
// It was not a hypothetical. On the fixture project a swallowed handler and a
// collapsed answer at THE SAME SITE both scored 30, the merge kept the higher
// one, and the headline read "swallows the failure" — the linter's half of the
// finding — with "also breaks: default-on-error" beneath it. The brief for this
// tool says rule 1 is the weakest and must not be the banner; a tie that lets
// it take the banner anyway is that instruction quietly lost.
const RULE_WEIGHT = { swallowed: 0.5 };

export function score(meta, rule) {
  const c = components(meta);
  const w = RULE_WEIGHT[rule] ?? 1;
  return Math.round(100 * c.conventionality * c.population * c.rarity * w);
}

// States that are NOT findings have no business in the ranking, however high
// the arithmetic would put them.
const NOT_A_FINDING = new Set(['TOO_FEW_PEERS', 'NO_SOURCES']);

// MERGING. One site can break several rules at once — a handler that swallows
// the failure AND answers []. That is one decision for a human to make, so it
// is one entry; the other rules stand beside it as further justification.
//
// The unit comes from meta.unit (the enclosing function), and where that is
// absent, from the file+anchor pair. Merging happens WITHIN one run, so a line
// number would be safe here — the anchor is used anyway, for symmetry with the
// fingerprint.
function unitKey(f, detector) {
  return [detector, f.file, (f.meta && f.meta.unit) || f.anchor || f.line || 0].join('|');
}

export function rankSnapshots(snapshots) {
  const groups = new Map();
  for (const s of snapshots)
    for (const f of s.findings) {
      const kind = f.meta && f.meta.kind;
      if (kind && NOT_A_FINDING.has(kind)) continue;
      const detector = f.detector || s.detector;
      const k = unitKey(f, detector);
      const rec = { ...f, detector, root: s.root, score: score(f.meta, f.rule), comp: components(f.meta) };
      const prev = groups.get(k);
      if (!prev) { groups.set(k, { ...rec, alsoBreaks: [] }); continue; }
      // the strongest rule stays; the weaker ones are listed beside it
      if (rec.score > prev.score) groups.set(k, { ...rec, alsoBreaks: [...prev.alsoBreaks, prev.rule] });
      else prev.alsoBreaks.push(rec.rule);
    }
  const out = [...groups.values()];
  out.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file) || (a.line || 0) - (b.line || 0));
  return out;
}

export function printRanking(snapshots, { top = 20 } = {}) {
  const ranked = rankSnapshots(snapshots);
  const skipped = snapshots.reduce((n, s) =>
    n + s.findings.filter(f => f.meta && NOT_A_FINDING.has(f.meta.kind)).length, 0);

  console.log(t('rankTitle'));
  console.log(t('rankSnapshots', snapshots.length, snapshots.map(s => s.detector).join(', ')));
  console.log(t('rankFindings', ranked.length) + (skipped ? t('rankSkipped', skipped) : ''));
  console.log('');
  console.log(t('rankFormula'));
  console.log('');

  ranked.slice(0, top).forEach((f, i) => {
    const c = f.comp;
    console.log(String(i + 1).padStart(3) + '. [' + String(f.score).padStart(3) + ']  ' +
      String(f.rule).padEnd(17) + '  ' + f.file + (f.line ? ':' + f.line : ''));
    console.log('       ' + f.label);
    console.log(t('rankComponents', (c.conventionality * 100).toFixed(0), c.peers, c.odd));
    if (f.alsoBreaks && f.alsoBreaks.length) console.log(t('rankAlsoBreaks', f.alsoBreaks.join(', ')));
  });

  if (ranked.length > top) console.log(t('rankMore', ranked.length - top));
  return ranked;
}
