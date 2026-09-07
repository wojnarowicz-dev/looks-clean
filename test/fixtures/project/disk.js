// FIXTURE — rule 1 (swallowed), the version WITH neighbours.
//
// Four reads of the file system, four handlers. Three of them keep the failure:
// one rethrows, one logs it, one records the reason into the value it returns.
// readManifest keeps nothing at all — after it has run there is no evidence
// anywhere in the process that a read was attempted and failed.
//
// This one a linter will also flag, and that is the point of leaving rule 1 at
// the bottom of the ranking. What a linter cannot add is the second half of the
// sentence: three of your own four handlers here do it the other way.
const fs = require('fs');

function readConfig(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error('config unreadable: ' + e.message);
  }
}

function readCache(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (e) {
    console.warn('cache unreadable, starting empty', e);
    return { ok: false, value: null };
  }
}

function readIndex(path) {
  let why = null;
  let text = null;
  try {
    text = fs.readFileSync(path, 'utf8');
  } catch (e) {
    why = 'index unreadable: ' + e.code;
  }
  return { ok: why === null, text: text, reason: why };
}

// THE PLANTED DEVIATION. The comment is the only record that anything happened,
// and comments do not reach the caller.
function readManifest(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    /* no manifest is fine */
  }
  return null;
}

module.exports = { readConfig, readCache, readIndex, readManifest };
