// looks-clean — the four states a run can leave behind, in one shape.
//
// WHY A FIELD AND NOT A SENTENCE. A person reading the terminal can tell
// "three findings" from "nothing to read". A build cannot: it gets one number,
// and every tool spells that number differently, so the honest states collapse
// into whatever the exit code happened to be. Four tools, four vocabularies,
// one CI job that treats them all as pass or fail.
//
// The four are chosen so that each answers a different question, and none of
// them is a rephrasing of another:
//
//   actionable      somebody has to decide something. The only one that is
//                   allowed to make a build red.
//   explained       looked at, and a reason was recorded for leaving it —
//                   a mute with a written cause, or a group too small to
//                   compare against. A human already answered this.
//   notApplicable   out of scope by construction: generated files, paths
//                   behind an exclusion. Nothing was skipped by accident.
//   unreachable     the run could not look. This is the state that must never
//                   be mistaken for a clean result, and it is the whole reason
//                   this tool exists.
//
// NOTHING NEW IS COUNTED HERE. Every number already existed in the run; they
// were simply never gathered into a shape a machine could read.

/**
 * @param snap a finished snapshot, AFTER mutes have been applied — a muted
 *             finding is explained, not actionable, and the two counts differ.
 */
export function summaryOf(snap) {
  const c = snap.counts || {};
  const n = k => (typeof c[k] === 'number' ? c[k] : 0);

  // NOTHING READ AT ALL IS UNREACHABLE, and this is the case the field was
  // asked for. An empty directory, a root that holds no source this build can
  // parse, a path whose contents are all behind exclusions: the run examined
  // nothing and therefore proved nothing. It used to say so in a sentence and
  // then exit 0, which is the tool committing its own subject matter — "I
  // found nothing" standing in for "I could not look".
  //
  // Counted as one: the root is the thing that could not be read.
  const nothingRead = n('files') === 0 && n('htmlBlocks') === 0 ? 1 : 0;

  return {
    actionable: snap.findings ? snap.findings.length : 0,
    // Both kinds of mute are explanations someone wrote down: one in the
    // config file, one on the line itself.
    explained: n('passedOver') + n('mutedCount') +
      (typeof snap.mutedByCommentCount === 'number' ? snap.mutedByCommentCount : 0),
    notApplicable: n('generated') + n('notReadBehindExclusions'),
    unreachable: n('parseErrors') + n('unreadable') + nothingRead,
  };
}

/**
 * The exit code a finished run deserves.
 *
 * DIFFERENTIAL BY DEFAULT, and that is a decision rather than an oversight.
 * A state gate — red whenever anything is actionable — turns a project with
 * seven hundred known findings permanently red, and a build that is red every
 * day teaches people to switch the tool off. So the default reports what is
 * NEW, and `--fail-on-state` is there for anyone who wants the other contract.
 *
 * UNREACHABLE OUTRANKS EVERYTHING, BUT ONLY WHEN IT UNDERMINES THE ANSWER.
 *
 * The first version of this returned 2 whenever anything at all was
 * unreachable, which is what the plan said. Then it was measured, and FIVE OF
 * NINE real corpora exited 2 permanently — got and verdaccio over one file
 * each, smooth-app over five out of six hundred and ninety-nine. A code that
 * every real repository shows every day is a code nobody reads, and that is
 * the same mistake this project refused to make with actionable: a build
 * that is red every day teaches people to switch the tool off.
 *
 * So the condition is narrower and says what it means. The danger this whole
 * tool exists to report is a clean result that is really an unread one — "I
 * found nothing" standing in for "I could not look". That is exactly
 * unreachable > 0 AND actionable === 0:
 *
 *   empty directory            unreachable 1, actionable 0   ->  2
 *   a tree of unparseable files  unreachable N, actionable 0 ->  2
 *   got: one bad file, nine findings                         ->  1 or 0
 *
 * A run that DID produce findings looked at something and its answer stands;
 * the part it could not read is still counted in the field, where a build that
 * cares can test summary.unreachable on purpose rather than by accident.
 */
export function exitCodeFor(summary, { newActionable, failOnState = false }) {
  if (summary.unreachable > 0 && summary.actionable === 0) return 2;
  if (failOnState) return summary.actionable > 0 ? 1 : 0;
  return newActionable > 0 ? 1 : 0;
}
