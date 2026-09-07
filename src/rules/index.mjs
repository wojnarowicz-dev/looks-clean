// looks-clean — the four rules, in the order they are reported.
//
// A SEPARATE MODULE FROM THE SCAN, on purpose. `scan.mjs` reads process.argv at
// import time — it is the detector, not a library — so importing it merely to
// ask what the rules are called would run a whole analysis. The `rules` screen
// and the flag validation both need the list and neither needs the scan.
//
// THE ORDER IS THE ORDER OF THE BRIEF, not of strength. Rule 1 is first because
// it is the one everybody thinks of, and last in the ranking because it is the
// one a linter already has. The ranking sorts by evidence; this list does not.
import * as swallowed from './swallowed.mjs';
import * as defaultOnError from './default-on-error.mjs';
import * as noTimeout from './no-timeout.mjs';
import * as sameAnswer from './same-answer.mjs';

export const RULES = [swallowed, defaultOnError, noTimeout, sameAnswer];
export const RULE_IDS = RULES.map(r => r.id);
export const NEEDS_POPULATION = Object.fromEntries(RULES.map(r => [r.id, r.needsPopulation]));
