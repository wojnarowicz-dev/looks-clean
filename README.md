# looks-clean

*[Polski](README.pl.md)*

**For the person who has to answer, at two in the morning, whether the screen is
empty because there is nothing there or because something broke — and who has no
way to tell from the code.**

`looks-clean` reads a JavaScript or TypeScript project and finds the places
where a failure is indistinguishable from an empty result: where the program
says *I found nothing* instead of *I could not check*.

It does not have opinions. It has neighbours.

<!-- lc:claim name=rules value=4 -->
<!-- lc:claim name=rulesNeedingPopulation value=3 -->
<!-- lc:claim name=layers value=10 -->
<!-- lc:claim name=knownAnswers value=6 -->
<!-- lc:claim name=knownAnswersInScope value=5 -->
<!-- lc:claim name=families value=8 -->
<!-- lc:claim name=languages value=2 -->
<!-- lc:claim name=messages value=135 -->
<!-- lc:claim name=fixtureFindings value=7 -->
<!-- lc:claim name=fixturePlanted value=4 -->
<!-- lc:claim name=cleanFindings value=0 -->
<!-- lc:claim name=defaultExclusions value=13 -->

## How this differs from your linter

Naming this precisely is the only reason to believe anything else on this page.

An empty `catch` is already reported by **eslint** (`no-empty`), by the **Dart
analyzer** (`empty_catches`) and by the **C# analyzer** (`AL0115`). All three
carry their judgement with them: the construct is bad wherever it appears, in
any project, on any line. They need to read nothing but the file in front of
them, and that is their strength.

This tool cannot say any of that, and does not try. It has no view on whether an
empty catch is bad. What it has is the rest of your repository, and the sentence
it produces has this shape:

> **5 of 7 error handlers on supabase in this file carry the outcome alongside
> the value. This one does not.**

That sentence is not in any linter's vocabulary, because a linter has no
population. It is also the only sentence here worth acting on: it does not ask
you to adopt a practice, it points out that you already have one and that this
site is outside it.

Concretely, on the same code:

| | eslint `no-empty` et al. | looks-clean |
|---|---|---|
| `catch { }` | reports it | reports it, and says how many neighbours do not |
| `catch { return []; }` | silent — the block is not empty | reports it if the neighbours answer `{ ok, value }` |
| `catch { return []; }` where every neighbour does too | silent | **silent, and says so with a count** |
| `await fetch(url)` with no deadline | silent | reports it if the reads beside it have one |
| the same, where nothing in the layer has a deadline | silent | **silent, and says so with a count** |

The two rows in bold are the ones that make it usable. A tool that reported
every bare `catch { return [] }` would be a linter with worse rules.

## What it does not do

* **It does not change files.** It prints a fix to paste, and the fix names the
  mechanism the neighbours already use — not a mechanism in general.
* **It does not judge a convention, only a deviation from one.** Where no
  neighbour does it the other way, nothing is reported. That silence is counted
  and named in the run header; it is never a blank.
* **It does not know whether a finding is a bug.** This class of tool has a
  published precision of 18.1% (PR-Miner). Read, judge, mute.
* **It does not read Java, Python, Dart, Go or SQL.** One language first, chosen
  by measurement — see [Why JavaScript first](#why-javascript-first).
* **It does not replace your linter.** Run both. They overlap on exactly one of
  the four rules, and that one is deliberately the weakest here.

## The four rules

| # | rule | needs neighbours | what it finds |
|---|------|------------------|----------------|
| 1 | `swallowed` | no — the weakest | a handler that swallows the failure with no log and no trace in the interface |
| 2 | `default-on-error` | yes | a handler that answers `[]`, `0`, `null` or `false` where that same value already means "no data" |
| 3 | `no-timeout` | yes | a read with no time limit, standing beside reads of the same kind that have one |
| 4 | `same-answer` | yes | a function whose failure path and empty path end in the same expression |

Rule 1 stands alone, which is exactly why it is the weakest. It is the only one
of the four your linter already covers, so it is scored at half weight in the
ranking (`src/rank.mjs`) and can never take the top of a list from a measured
deviation. It stays for two reasons: when it *does* have neighbours it becomes a
comparison a linter cannot make, and it supplies half the evidence at sites that
break several rules at once.

## What it looks like

<!-- lc:example lang=en -->
```
## [1] default-on-error   api.js:44

     sb.rpc answers [] on failure, and [] also means "no data"

WHERE YOU DIFFER FROM YOUR OWN CODE
     3 of 4 error handlers on supabase in this file api.js carry the outcome alongside the
     value. This one does not:
       api.js:13   sb.rpc — answers with the outcome attached
       api.js:22   sb.rpc — answers with the outcome attached
       api.js:31   sb.rpc — answers with the outcome attached

WHY IT MATTERS
     [] is exactly what a healthy read returns when there is genuinely nothing
     there. The caller receives the same value either way, so "could not check"
     arrives dressed as "checked, and there is none".

FIX
     Say which of the two it is, the way the neighbours above already do.
     Not a defect? Write `// looks-clean: ok — reason` on that line, or above it.
```

Reproduce it:

    $ looks-clean scan test/fixtures/project --rule default-on-error --top 1

Everything above is a real run over `test/fixtures/project`, and
`test/readme.mjs` re-runs it and compares this block with the output line for
line. The three cited lines are the part no rulebook could have produced, and
`test/evidence.mjs` separately checks that each of them exists and really does
what the finding says it does.

## Getting started

Node 18 or newer.

```
git clone https://github.com/wojnarowicz-dev/looks-clean.git
cd looks-clean
npm install
```

    $ looks-clean scan <dir> --json .looks-clean/run.json
    $ looks-clean rank .looks-clean/run.json
    $ looks-clean rules

Scan and save the run; read it strongest-evidence-first; run it again later and
only what is NEW since last time is shown. After `npm i -g` the command is
`looks-clean`; inside a clone use `npx looks-clean` or
`node bin/looks-clean.mjs`. Everything takes `--lang pl`.

| command | |
|---|---|
| `scan <dir>` | run the four rules over a JavaScript/TypeScript tree |
| `rank <run.json> [...]` | one ranked list across saved runs — what to read first |
| `diff <a.json> <b.json>` | what appeared, what is gone, what changed |
| `rules` | the four rules, and which of them needs neighbours |

Flags: `--rule`, `--layer`, `--minpop`, `--top`, `--verbose`, `--all`,
`--json`, `--config`, `--include-generated`, `--lang`, `--help`, `--version`.

Exit codes: `0` nothing new, `1` there are new findings, `2` your input is the
problem.

## The layer

Two sites are neighbours when they are **in the same place** and belong to the
**same family of operation** — supabase, net, db, proc, fs, parse, storage or a
dynamic import. Both halves matter: `saveDream` and `saveProfile` in one service
file are written by the same hand under the same constraints, and a `fetch` is
not comparable with a `JSON.parse`.

The layer climbs a ladder when a group is too small to speak:

```
--layer file (default)   the file, then the directory
--layer dir              the directory, then the whole scanned tree
--layer root             the whole scanned tree
```

The rung that actually spoke is printed with every finding. A comparison whose
scope the reader cannot see is a comparison they cannot check.

The top rung is never reached by accident: at project scale *"9 of 400 reads
have a deadline"* is a fact about the codebase rather than about this call. It
exists because a tree of Deno edge functions — one file per directory —
otherwise produced nothing at all.

## The score

```
score = conventionality x population x rarity
```

Multiplication, not a sum: a finding ranks high only when **all three** are
high. A strong convention over three examples means nothing, and neither does a
large population with half the sites deviating. The scale is ordinal — 94 means
"read this before the one scored 32", not "94% chance of a bug".

One site breaking several rules is merged into one entry, because it is one
decision for a person to make; the other rules stand beside it as
`also breaks:`.

## Muting

Write `// looks-clean: ok — reason` on the line or above it. The site is still
**read and still counted towards the population** — it only leaves the report. A
mute implemented as an exclusion would weaken the very rule that caught it.

`.looks-clean.json` in the scanned directory adds exclusions to the built-in
list. Exclusions change what is READ, and therefore change the population and
the finding; mutes change only what is SHOWN. The two are kept apart on purpose.

## Why JavaScript first

Measured, not chosen. Six known defects were traced by hand before any code was
written; **five of the six are JavaScript or TypeScript** and are reachable in
real material. The sixth is a SQL-migration checker and is recorded as out of
language scope rather than as missing — see `test/known-answers.mjs`.

Two further reasons, in order of weight:

* Rule 3 needs a population of reads that *mix* guarded and unguarded. In async
  JavaScript that population is dense and the mechanisms are recognisable:
  `AbortSignal.timeout`, an `AbortController` fired from a `setTimeout`,
  `Promise.race`, a `timeout:` option. In Java the same question is spread
  across a dozen unrelated APIs.
* The tokenizer and the parse layer came across from `odd-one-out` unchanged.
  One `tree-sitter-typescript` grammar reads `.js .mjs .cjs .ts .mts`, and the
  `tsx` grammar covers JSX. Nothing had to be invented before measuring could
  start.

The rest comes after measurement, which is the same discipline the tool asks of
its reader.

## Ten test layers

    $ npm test

One runner, `test/all.mjs`. Each layer catches something no other layer can see,
and each keeps its own exit code: `0` passed, `1` failed, `2` could not reach its
material. **A skipped layer is not a passing layer**, so a clean run of the whole
suite on this repository exits 2 — the migration checker in known answer 4 is
not JavaScript, and the suite refuses to call that a pass.

| | layer | what only it can see |
|---|---|---|
| 1 | `npm run vocabulary` | the tables the rules see through — an entry that matches nothing is invisible to every other layer |
| 2 | `npm run lang-check` | both languages complete, and no sentence bypassing the dictionary |
| 3 | `npm run negative` | code that must NOT be reported, with controls that must still fire |
| 4 | `npm run golden` | recorded runs, field by field, fingerprints included |
| 5 | `npm run amplify` | that the output depends on the input at all |
| 6 | `npm run population` | that each finding's arithmetic describes a real group |
| 7 | `npm run evidence` | that every cited neighbour exists and does what the finding says |
| 8 | `npm run resilience` | fail loudly, never quietly |
| 9 | `npm run readme` | that this page agrees with the tool, and what `npm pack` would ship |
| 10 | `npm run known-answers` | the six hand-traced defects, as a contract |

Every layer has a negative check: it was broken on purpose, seen to fail, and
reverted. A test that cannot be made to fail is not a test.

### Three defects these layers found in this tool's own code

The best evidence that a tool works is that it was turned on its author.

1. **A run that compared nothing reported `findings: 0`.** Caught by
   `test/resilience.mjs`. On a project where no peer group reached the
   threshold, three of the four rules had nothing to say and the run printed a
   zero and stopped — the reader could not tell that from a clean codebase. The
   rules now record *why* they went quiet, and the two silences are counted
   separately in the header. This is precisely the defect the tool reports in
   other people's code, shipped in the tool itself.

2. **A whole class of database read was invisible.** Caught by
   `test/vocabulary.mjs`. `sb.from('x').select('y')` was not recognised as a
   read at all, because the family matcher looked for a client called
   `supabase` — and real code writes `const sb = createClient(...)`. Every table
   read was missing from the population, so every finding in that group rested
   on weaker evidence than it claimed, and no count anywhere said so. Fixing it
   immediately broke `sb.rpc`, which the layer caught in the same run.

3. **The tool swallowed an error while looking for its own configuration.**
   Caught by running `npm run self-check` — the tool on its own source. A
   permission error while searching for `.looks-clean.json` was handled as "no
   configuration", which changes the exclusion list, which changes every
   population in the run. The only trace would have been a different number of
   findings.

The self-check is clean now, and the four sites where a swallowed failure is the
right answer carry a written `// looks-clean: ok — reason` saying why.

## Taken from odd-one-out

The parse layer, the tokenizer, the run snapshot and the diff between runs, the
ranking, the config and mute layers, the input and encoding layers, and the
shape of the golden and resilience suites came from `odd-one-out` rather than
being written again. Their comments came with them: several encode a defect paid
for once already — why the snapshot fingerprint contains no line number, and why
the snapshot is written to a sibling temporary file and renamed into place.

## Licence

MIT — Aleksander Wojnarowicz. See `LICENSE`.
