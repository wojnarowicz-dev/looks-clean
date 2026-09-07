// looks-clean — one judgement of "was there anything to compare against".
//
// WHY THIS IS ITS OWN MODULE, AND WHY IT IS THE FIRST ONE WRITTEN. Three of the
// four rules here are comparisons against neighbours. A comparison with no
// neighbours produces zero findings, and zero findings printed without a word
// is indistinguishable from a clean project. That is the tool's own subject
// matter turned on itself: an empty directory answering `sites=0` reads exactly
// like a codebase with nothing wrong in it.
//
// So every exit through "nothing to report" passes through here and says which
// of the two it was.
import { t } from './lang.mjs';

/**
 * Nothing of the requested kind was found on disk.
 * @param count how many files were found
 * @param kind  what we were looking for, e.g. ".js/.ts"
 * @param root  the directory that was scanned
 * @returns null when something was found, otherwise a message
 */
export function noSourcesIn(count, kind, root) {
  if (count > 0) return null;
  return t('noSourcesFound', kind, root) + '\n' + t('noSourcesHint');
}

/**
 * Files were read, but no rule had enough peers to compare against.
 * @param counts {sites, compared, peersNeeded}
 */
export function noPopulation(sites, compared, peersNeeded) {
  if (compared > 0) return null;
  return t('noPopulation', sites, peersNeeded) + '\n' + t('noPopulationHint');
}

/**
 * The per-rule verdict for one peer group: is this group big enough to speak?
 * Returned as a reason string rather than a boolean so the report can say WHY
 * a site was passed over instead of dropping it in silence.
 */
export function tooFewPeers(peers, threshold) {
  if (peers >= threshold) return null;
  return t('tooFewPeers', peers, threshold);
}
