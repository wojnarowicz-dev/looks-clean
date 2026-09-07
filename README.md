# looks-clean

**An empty `catch` is already found by eslint (`no-empty`), by the Dart analyzer
(`empty_catches`) and by the C# analyzer (`AL0115`); what none of them can say is
"`saveDream` has a time limit, `saveProfile` does not, and they are the same
layer" — the comparison with the neighbouring code is the whole of this tool.**

It finds the places where a failure is indistinguishable from an empty result:
where the program says *I found nothing* instead of *I could not check*.

A linter carries its judgement with it — an empty catch is bad wherever it is
found. Nothing here is bad in itself. A site is reported because the sites
**around it**, doing the same job at the same level, do it differently.

---

## The four rules

| # | rule | needs neighbours | what it finds |
|---|------|------------------|----------------|
| 1 | `swallowed` | no — the weakest | a handler that swallows the failure with no log and no trace in the interface |
| 2 | `default-on-error` | yes | a handler that answers `[]`, `0`, `null` or `false` where that same value already means "no data" |
| 3 | `no-timeout` | yes | a read with no time limit, standing beside reads of the same kind that have one |
| 4 | `same-answer` | yes | a function whose failure path and empty path end in the same expression |

Rules 2, 3 and 4 need a population: they compare a site with its peers and report
only a deviation. **Where there is no convention to break, nothing is reported —
and the run says so out loud**, with a count, rather than printing `findings: 0`.

Rule 1 stands alone, and that is exactly why it is the weakest of the four. It is
scored at half weight in the ranking (see `src/rank.mjs`) so it can never take the
top of a list from a measured deviation. It earns its place for two reasons:
when it *does* have neighbours it becomes a comparison a linter cannot make, and
it supplies half the evidence for the other rules at sites that break several at
once.

## What it looks like

```
## [1] default-on-error   vap-account-panel.js:248

     sb.rpc answers [] on failure, and [] also means "no data"

WHERE YOU DIFFER FROM YOUR OWN CODE
     4 of 6 error handlers on supabase in this file vap-account-panel.js carry
     the outcome alongside the value. This one does not:
       vap-account-panel.js:185   sb.rpc — answers with the outcome attached
       vap-account-panel.js:225   sb.rpc — answers with the outcome attached
       vap-account-panel.js:235   sb.rpc — answers with the outcome attached
       vap-account-panel.js:1293  sb.rpc — answers with the outcome attached

WHY IT MATTERS
     [] is exactly what a healthy read returns when there is genuinely nothing
     there. The caller receives the same value either way, so "could not check"
     arrives dressed as "checked, and there is none".

FIX
     Say which of the two it is, the way the neighbours above already do.
```

That is a real finding in real code, and the four lines under the heading are the
part no rulebook could have produced.

## Getting started

Node 18 or newer.

```
git clone <this repo> && cd looks-clean && npm install

npx looks-clean scan ./src --json .looks-clean/run.json   # scan, and save the run
npx looks-clean rank .looks-clean/run.json                # read it, strongest evidence first
npx looks-clean scan ./src --json .looks-clean/run.json   # later: only what is NEW
```

After `npm i -g` the command is just `looks-clean`. Everything reads `--lang pl`
for Polish.

| command | |
|---|---|
| `scan <dir>` | run the four rules over a JavaScript/TypeScript tree |
| `rank <run.json> [...]` | one ranked list across saved runs — what to read first |
| `diff <a.json> <b.json>` | what appeared, what is gone, what changed |
| `rules` | the four rules, and which of them needs neighbours |

Useful flags: `--rule <ids>`, `--layer file|dir|root`, `--minpop 3`, `--top 15`,
`--verbose`, `--all`, `--include-generated`, `--config <file>`.

Exit codes: `0` nothing new, `1` there are new findings, `2` your input is the
problem.

## The layer

Two sites are neighbours when they are **in the same place** and belong to the
**same family of operation** — network, supabase, database, file system,
subprocess, parse, storage. Both halves matter: `saveDream` and `saveProfile` in
one service file are written by the same hand under the same constraints, and a
`fetch` is not comparable with a `JSON.parse`.

The layer climbs a ladder when a group is too small to speak:

```
--layer file (default)   the file, then the directory
--layer dir              the directory, then the whole scanned tree
--layer root             the whole scanned tree
```

The rung that actually spoke is printed with every finding. A comparison whose
scope the reader cannot see is a comparison they cannot check.

The top rung is never reached by accident, and the reason is written into
`src/layer.mjs`: at project scale, *"9 of 400 reads have a deadline"* is a fact
about the codebase rather than about this call. It exists because a tree of Deno
edge functions — one file per directory — otherwise produced nothing at all.

## The score

```
score = conventionality x population x rarity
```

Multiplication, not a sum: a finding ranks high only when **all three** are high.
A strong convention over three examples means nothing, and neither does a large
population with half the sites deviating. The scale is ordinal — 94 means "read
this before the one scored 32", not "94% chance of a bug".

One site breaking several rules is merged into one entry, because it is one
decision for a person to make; the other rules stand beside it as `also breaks:`.

## Why JavaScript first

Measured, not chosen. Six known defects were traced by hand before any code was
written; **five of the six are JavaScript or TypeScript** and are reachable in
material on this machine — the sixth is a SQL-migration checker and is recorded
as out of language scope rather than as missing (`test/known-answers.mjs`).

Two further reasons, in order of weight:

* Rule 3 needs a population of reads that *mix* guarded and unguarded. In async
  JavaScript that population is dense and the mechanisms are recognisable —
  `AbortSignal.timeout`, an `AbortController` fired from a `setTimeout`,
  `Promise.race`, a `timeout:` option. In Java the same question is spread across
  a dozen unrelated APIs.
* The tokenizer and the parse layer came across from `odd-one-out` unchanged:
  one `tree-sitter-typescript` grammar reads `.js .mjs .cjs .ts .mts`, and the
  `tsx` grammar covers JSX. Nothing had to be invented to start measuring.

The rest comes after measurement, which is the same discipline the tool asks of
its reader.

## What it will not do

* It never changes a file. It prints a fix to paste, and the fix names what the
  neighbours already use.
* It is noisy by nature. This class of tool has a published precision of 18.1%
  (PR-Miner). Read, judge, mute.
* Muting is done in place: write `// looks-clean: ok — reason` on the line or
  above it. The site is still **read and still counted towards the population** —
  it only leaves the report. A mute implemented as an exclusion would weaken the
  very rule that caught it.
* Generated and bundled files are skipped, and the run says how many. A minifier's
  output is nobody's convention, and before this was added the report quoted
  `supabase-js-2.112.4.js:7` back at the reader three times as evidence about
  their own code. `--include-generated` reads them anyway.

## Tests

```
npm test               golden + resilience + language check
npm run known-answers  the six real defects (needs the sibling repositories)
```

**`test/golden.mjs`** — a full run over `test/fixtures/`, compared field by field
with a recording, fingerprints included. Four deviations are planted, one per
rule, and each is also asserted by name so a recording cannot be updated into
uselessness. `test/fixtures/README.md` describes every one of them — including
why not one of them would fail a linter.

**`test/resilience.mjs`** — thirteen scenarios that damage something on purpose,
each classified `LOUD` / `SPOKE` / `SILENT` / `CRASH`. Every scenario runs twice,
damaged and healthy, and a phrase only counts if the healthy run does **not**
print it — otherwise a scenario passes on the word "snapshot" appearing in
`run snapshot saved`. A `SILENT` run is a failure: a scanner that hits a broken
file, reads nothing and prints `findings: 0` has committed the defect it reports.

This suite has already earned its place. It caught the tool telling a project
with nothing to compare against that it had `findings: 0` — see the comment in
`src/scan.mjs`.

**`test/lang-check.mjs`** — every message exists in both languages with matching
argument slots, and no source file prints a sentence that bypassed the
dictionary. That third check found four neighbour notes hard-coded in English, so
`--lang pl` printed its headings in Polish and its evidence in English.

**`test/known-answers.mjs`** — the six. States are `LIVE`, `RECONSTRUCTED` and
`SKIP`; a `SKIP` exits 2 and names what would have to be supplied, because
"could not check" and "checked and fine" must not look alike — least of all here.

## Taken from odd-one-out

The parse layer, the tokenizer, the run snapshot and the diff between runs, the
ranking, the config and mute layers, the input and encoding layers, and the
shape of the golden and resilience suites all came from
[`odd-one-out`](../odd-one-out) rather than being written again. Their comments
came with them: several encode a defect that was paid for once already, such as
why the snapshot fingerprint contains no line number, and why the snapshot is
written to a sibling temporary file and renamed into place.

## Licence

MIT.
