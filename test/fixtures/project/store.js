// FIXTURE — rule 4 (same-answer).
//
// Four functions that read the same store and have both a failure path and an
// empty path. Three of them answer differently on the two; readEntries answers
// [] on both, so after it there is no difference left for a caller to ignore.
//
// Note that readEntries would pass every linter in existence: the catch is not
// empty, the error is not unused, the promise is handled.

async function readTags(db) {
  try {
    const rows = await db.query('select * from tags');
    return { ok: true, rows: rows || [] };
  } catch (e) {
    return { ok: false, rows: [], error: e };
  }
}

async function readNotes(db) {
  try {
    const rows = await db.query('select * from notes');
    return rows || [];
  } catch (e) {
    throw e;
  }
}

async function readDrafts(db) {
  try {
    const rows = await db.query('select * from drafts');
    return rows || [];
  } catch (e) {
    console.error('readDrafts failed', e);
    return null;
  }
}

// THE PLANTED DEVIATION. The empty path and the failure path meet.
async function readEntries(db) {
  try {
    const rows = await db.query('select * from entries');
    return rows || [];
  } catch (e) {
    console.error('readEntries failed', e);
    return [];
  }
}

module.exports = { readTags, readNotes, readDrafts, readEntries };
