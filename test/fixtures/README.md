# Fixtures

A synthetic project with exactly four planted deviations, one per rule, plus a
page that exercises the inline-`<script>` path.

Everything the golden tests read lives here. That is the difference between this
suite and `test/known-answers.mjs`: the known answers are six real defects in
real repositories and cannot run after a bare clone, which is right for them and
wrong for a golden test. A golden test that cannot run after a clone protects
nobody.

**None of these files would fail a linter.** Every `catch` has a body, every
promise is handled, every error binding that exists is used. What is wrong with
each planted site is only visible next to its neighbours — which is the whole
claim this tool makes.

## `project/api.js` — rule 2, `default-on-error`

Four reads of the same backend. `loadProfile`, `loadSettings` and `loadBadges`
answer `{ known, value }`; **`loadReviews` answers `[]`**, which is also what a
healthy read returns for an account with no reviews.

Reported twice on purpose: the same handler also leaves no trace, so rule 1 fires
too. The ranking merges them into one entry — one site, one decision — and keeps
`default-on-error` as the headline.

## `project/net.js` — rule 3, `no-timeout`

Four writes over the network. `saveDream`, `saveNote` and `saveTag` carry a
deadline (two by `AbortSignal.timeout`, one by an `AbortController` fired from a
`setTimeout` three lines up — both shapes must be recognised). **`saveProfile`
carries none.**

This is the fixture for the sentence the tool exists to say: *saveDream has a
time limit, saveProfile does not, and they are the same layer.*

## `project/store.js` — rule 4, `same-answer`

Four functions with both a failure path and an empty path. `readTags` answers a
tagged result, `readNotes` rethrows, `readDrafts` answers `null` where the empty
path answers `[]`. **`readEntries` answers `[]` on both.**

Two further findings come out of this file and are not accidents: `readDrafts`
and `readEntries` both hand back a default from their handler, so rule 2 reports
them against the two neighbours that do not. If a change makes those disappear,
something in rule 2 has narrowed.

## `project/disk.js` — rule 1, `swallowed`

Four file-system reads. `readConfig` rethrows, `readCache` logs, `readIndex`
records the reason into the value it returns. **`readManifest` keeps nothing** —
a comment is the only record, and comments do not reach the caller.

`readIndex` is the load-bearing one here. It records the failure into a variable
called `why`, not `error`, and it never calls a logger. An earlier version of the
rule matched a list of approved logging calls and classified `readIndex` as a
swallower — which would have left this file with no convention to deviate from,
and no finding at all.

## `page/index.html` — the inline-script path

Four `fetch` calls in one inline `<script>`; **`loadNews` has no deadline.**

The page also contains an HTML comment that mentions `<script>`, and a
`type="application/ld+json"` block that is not JavaScript. Both are traps: the
first used to swallow the rest of the page into one "script block", and the
second used to reach the parser as source. Any finding reported from either is a
regression, and the reported line numbers must point at lines in the HTML file
rather than at lines in the extracted block.

## Updating the recordings

    node test/golden.mjs            check
    node test/golden.mjs --update   re-record

Read the diff `--update` prints before committing it. An expectation updated
without looking is a test deleted.
