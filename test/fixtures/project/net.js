// FIXTURE — rule 3 (no-timeout).
//
// Four writes over the network, one file, one layer. Three of them put a
// deadline on the request; saveProfile does not. When that request hangs, no
// catch runs and no branch is taken: the screen keeps whatever it had, which
// is the shape of failure this whole tool is named after.
//
// This is the sentence no linter can produce, because it is not about saveProfile
// on its own: saveDream has a time limit, saveProfile does not, and they are the
// same layer.

async function saveDream(url, body) {
  const res = await fetch(url + '/dream', {
    method: 'POST',
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  return res.json();
}

// THE PLANTED DEVIATION. Same layer, same verb, same backend, no deadline.
async function saveProfile(url, body) {
  const res = await fetch(url + '/profile', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.json();
}

async function saveNote(url, body) {
  const res = await fetch(url + '/note', {
    method: 'POST',
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  return res.json();
}

async function saveTag(url, body) {
  const controller = new AbortController();
  setTimeout(function () { controller.abort(); }, 8000);
  const res = await fetch(url + '/tag', {
    method: 'POST',
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  return res.json();
}

module.exports = { saveDream, saveProfile, saveNote, saveTag };
