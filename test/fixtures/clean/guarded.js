// CLEAN — nothing here may be reported.
//
// Four network writes, four deadlines, in three different spellings. Rule 3 has
// no deviation to find because there is none: this is the file it wants every
// other file to look like.
//
// The three spellings are the point. A version of the deadline table that
// recognised only `AbortSignal.timeout` would report the other two as bare, and
// the report would tell a reader who had already done the work that they had
// not done it.

async function saveDream(url, body) {
  try {
    const res = await fetch(url + '/dream', {
      method: 'POST',
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    return res.json();
  } catch (e) {
    throw new Error('saveDream failed: ' + e.message);
  }
}

async function saveProfile(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 8000);
  try {
    const res = await fetch(url + '/profile', {
      method: 'POST',
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return res.json();
  } catch (e) {
    throw new Error('saveProfile failed: ' + e.message);
  } finally {
    clearTimeout(timer);
  }
}

async function saveNote(url, body) {
  try {
    const res = await Promise.race([
      fetch(url + '/note', { method: 'POST', body: JSON.stringify(body) }),
      rejectAfter(8000),
    ]);
    return res.json();
  } catch (e) {
    throw new Error('saveNote failed: ' + e.message);
  }
}

async function saveTag(url, body) {
  try {
    const res = await fetch(url + '/tag', {
      method: 'POST',
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    return res.json();
  } catch (e) {
    throw new Error('saveTag failed: ' + e.message);
  }
}

module.exports = { saveDream, saveProfile, saveNote, saveTag };
