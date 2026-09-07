// CLEAN — nothing here may be reported.
//
// One subprocess call, and nothing anywhere in this tree to compare it with.
// It has no deadline, its handler answers null, and both of those would be
// findings in a file with neighbours. Here they are not findings, they are an
// absence of evidence, and the run says so: "passed over for want of
// neighbours", with a count.
//
// A tool that reported this would be inventing a convention rather than
// measuring one — which is the failure mode of every rulebook, and the reason
// this one is built the way it is.
const { execFileSync } = require('child_process');

function currentRevision(repo) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  } catch (e) {
    console.error('cannot read the revision of ' + repo + ': ' + e.message);
    return null;
  }
}

module.exports = { currentRevision };
