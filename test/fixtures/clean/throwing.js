// CLEAN — nothing here may be reported.
//
// Four database reads and not one deadline between them. That is a decision
// about this layer, not a deviation inside it, and this tool has no opinion
// about it: rule 3 needs somebody in the group to do it the other way before it
// will say anything. The run counts these under "layers where every peer does
// it the same way" and moves on.
//
// The failure path throws, so none of these is a rule 4 candidate: a function
// with no failure RETURN cannot have its two answers collide.

async function readTags(db) {
  try {
    const rows = await db.query('select * from tags');
    return rows || [];
  } catch (e) {
    throw new Error('readTags: ' + e.message);
  }
}

async function readNotes(db) {
  try {
    const rows = await db.query('select * from notes');
    return rows || [];
  } catch (e) {
    throw new Error('readNotes: ' + e.message);
  }
}

async function readDrafts(db) {
  try {
    const rows = await db.query('select * from drafts');
    return rows || [];
  } catch (e) {
    throw new Error('readDrafts: ' + e.message);
  }
}

async function readEntries(db) {
  try {
    const rows = await db.query('select * from entries');
    return rows || [];
  } catch (e) {
    throw new Error('readEntries: ' + e.message);
  }
}

module.exports = { readTags, readNotes, readDrafts, readEntries };
