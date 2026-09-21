# looks-clean

[![tests](https://github.com/wojnarowicz-dev/looks-clean/actions/workflows/ci.yml/badge.svg)](https://github.com/wojnarowicz-dev/looks-clean/actions/workflows/ci.yml)
[![known answers: 5 of 7 need private material](https://img.shields.io/badge/known%20answers-5%20of%207%20need%20private%20material-yellow)](test/known-answers.mjs)

> The green badge covers the ten test layers. It does **not** cover five of the
> seven known answers: they need repositories that are not public, so CI reports
> them as unreachable rather than as passing. The second badge says so, and
> `test/readme.mjs` checks that its number is the number the suite reports.

*[Polski](README.pl.md)*

**For the person who has to answer, at two in the morning, whether the screen is
empty because there is nothing there or because something broke — and who has no
way to tell from the code.**

`looks-clean` reads a JavaScript, TypeScript or Java project and finds the places
where a failure is indistinguishable from an empty result: where the program
says *I found nothing* instead of *I could not check*.

It does not have opinions. It has neighbours.

## Run it without installing

```
npx looks-clean scan .
```

Node 18 or newer. Nothing to clone, nothing to configure, no config file:
the tool reads the project you point it at and nothing else. Every command
on this page works the same way with `npx looks-clean` in front of it.

<!-- lc:claim name=rules value=4 -->
<!-- lc:claim name=rulesNeedingPopulation value=3 -->
<!-- lc:claim name=layers value=10 -->
<!-- lc:claim name=knownAnswers value=7 -->
<!-- lc:claim name=knownAnswersInScope value=6 -->
<!-- lc:claim name=families value=8 -->
<!-- lc:claim name=languages value=2 -->
<!-- lc:claim name=messages value=139 -->
<!-- lc:claim name=fixtureFindings value=7 -->
<!-- lc:claim name=fixturePlanted value=4 -->
<!-- lc:claim name=cleanFindings value=0 -->
<!-- lc:claim name=defaultExclusions value=19 -->
<!-- lc:claim name=precisionMeasurements value=2 -->
<!-- lc:claim name=precisionProjects value=3 -->
<!-- lc:claim name=precisionReported value=27 -->
<!-- lc:claim name=precisionChecked value=10 -->
<!-- lc:claim name=precisionReal value=2 -->
<!-- lc:claim name=precisionNoise value=8 -->
<!-- lc:claim name=precisionReportedBefore value=409 -->
<!-- lc:claim name=precisionCheckedBefore value=30 -->
<!-- lc:claim name=precisionRealBefore value=2 -->
<!-- lc:claim name=precisionNoiseBefore value=28 -->
<!-- lc:claim name=precisionTestCode value=12 -->
<!-- lc:claim name=javaSampleReported value=89 -->
<!-- lc:claim name=javaRandomChecked value=20 -->
<!-- lc:claim name=javaRandomReal value=14 -->
<!-- lc:claim name=javaRandomDeliberate value=3 -->
<!-- lc:claim name=javaRandomNoise value=3 -->
<!-- lc:claim name=javaFirstChecked value=20 -->
<!-- lc:claim name=javaFirstReal value=9 -->
<!-- lc:claim name=javaFirstDeliberate value=5 -->
<!-- lc:claim name=javaFirstNoise value=6 -->
<!-- lc:claim name=javaNoisyRules value=1 -->

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

## How often it is wrong

Three measurements. Two on six JavaScript projects, none of them mine; a third
on Java, taken before 0.2.0 shipped. None of them is averaged into another.

The first two, side by side. They are printed side by side
rather than as one corrected figure, because the tool changed between them and so
did the material — and a single revised number would hide both facts.

|  | first run | second run |
|---|---|---|
| **date** | 2026-09-07 | 2026-09-07 |
| **tool** | before test code was excluded | after test code was excluded |
| **real defects** | **2** | **2** |
| **false alarms** | **28** | **8** |
| **checked** | 30 | 10 |
| **reported in total** | 409 | 27 |

Ten checked out of 359 is ten checked. Neither number is the precision of the
tool over a whole run, and nothing here claims otherwise.

### First run — before test code was excluded

| project | character | reported | checked | real | false |
|---|---|---:|---:|---:|---:|
| [got](https://github.com/sindresorhus/got) | HTTP client library, TypeScript | 359 | 10 | 0 | 10 |
| [uptime-kuma](https://github.com/louislam/uptime-kuma) | monitoring application, JavaScript | 34 | 10 | 2 | 8 |
| [eslint](https://github.com/eslint/eslint) | developer tool, JavaScript | 16 | 10 | 0 | 10 |

**What the false alarms had in common.** In 20 of the 28 the failure *was*
handled — by a deadline on the enclosing call, by an HTTP 400, by a compensating
`destroy()`, by a documented fallback, or by a test whose whole subject was the
missing deadline.

The largest single lever was cruder than that: **12 of the 30 were test code**,
and 350 of got's 359 findings were under `test/`. A test file is not a layer —
its shape is dictated by what each test is testing — so test directories were
added to the built-in exclusions. That is the one change between the two runs.

### Second run — after test code was excluded

| project | character | reported | checked | real | false |
|---|---|---:|---:|---:|---:|
| [verdaccio](https://github.com/verdaccio/verdaccio) | private npm registry server, TypeScript | 27 | 10 | 2 | 8 |
| [node-red](https://github.com/node-red/node-red) | visual programming runtime, JavaScript | 0 | 0 | 0 | 0 |
| [fastify](https://github.com/fastify/fastify) | web framework, JavaScript | 0 | 0 | 0 | 0 |

**Two of the three reported nothing, and neither zero was about precision.**
They are the useful part of this run.

*fastify* is a legitimate zero: 113 error handlers and 8 external reads. A web
framework **receives** calls rather than making them, so rules 2 and 3 had almost
nothing to group — and the run said so, four sites passed over and four layers
with no convention, rather than printing a bare zero. It also shows the selection
criterion was blunt: what these rules need is not density of error handling but
density of error handling **over external reads**.

*node-red* is not a legitimate zero. The tool read 11 files of a repository
holding 308 JavaScript source files, because node-red keeps its source under
`packages/node_modules/` and the built-in `**/node_modules/**` exclusion swallowed
all of it — **and the run did not say so.** `findings: 0` where it meant *I did
not look*. That is this tool's own subject, in this tool, found by pointing it at
a codebase with an unusual layout.

**What the false alarms have in common now.** Five of the eight record the
failure somewhere the tool does not read: a `console.warn` four lines below the
handler, an `undefined` check, a stream's `error` event, or the fall-through
itself. That is the first run's common factor sharpened — the tool reads the
handler's body and the value it returns, and in real code the record of a failure
is very often just outside both.

### Defects the measurements found in the tool

Five. **Four are unfixed on purpose**, because each of them changes *which*
findings come out, and fixing those then re-measuring on the same projects would
be tuning the tool to its own test — which is how a precision number becomes
worthless:

* `{ timeout }` written as a shorthand property is not recognised as a deadline
* every `fs.*` call is treated as a read, including writes, stream constructors
  and `*Sync` calls that can never carry a deadline
* a chained `fsp.stat(...).catch(...)` is counted twice and reported twice
* a failure caught by a plain predicate is filed as the empty path

**The fifth was fixed immediately**, and it is the one worth reading about. On
node-red the tool printed `findings: 0` where it meant *I did not look* — the
cleanest example of what these four rules exist to catch, found in the tool
itself. That could not be left standing to protect a number, and fixing it
changes no finding: it adds a sentence about what was never read.

Every run that excludes anything now says how much source sat behind the
exclusions, names the largest with the pattern that removed it, and gets louder
when more was excluded than read:

```
read: 11 files, 76 functions, 14 error handlers, 19 external reads
not read: 741 file(s) behind 12 excluded director(ies) (counted up to a cap, so at least that many), and 9 excluded file(s)
   largest: packages/node_modules/@node-red/ (>=500, **/node_modules/**), test/unit/ (147, **/test/**)
   More was excluded than was read. If your sources live under a path that looks
   like a dependency or a test directory, they were skipped: read the list above
   before taking this result for a clean one.
```

`test/resilience.mjs` holds it in place: remove the fix and the scenario
*sources under an excluded directory* goes SILENT, which fails the layer.

Excluding test code was a third kind of thing again — a scope correction, true
before the measurement and not derived from it.

### Java — the third measurement, and the first screen is the worse one

Java arrived in 0.2.0. Before it shipped, twenty findings were drawn **at
random** from a real Java run and read at the line each one cites — and then
twenty more, the **top of the printed list**, because that is the screen a
person actually sees. The two numbers are different, and both are here for that
reason.

| | random twenty | first twenty |
|---|---:|---:|
| **real defects** | **14** | **9** |
| **deliberate, and defensible** | 3 | 5 |
| **false alarms** | **3** | **6** |
| checked | 20 | 20 |

Material: one 21-file directory of a Java desktop application, 89 findings
reported, default settings. Sample: seed `looks-clean-java-0.2.0`, recorded in
`test/precision.json`, so the same twenty come back without me.

**These are sites in a closed-source product: the locations are withheld, the
verdicts and causes are published.** Fourteen of the twenty are real defects in
something that is sold and most are still unfixed, so a file and a line beside
each would be a public bug list for somebody else's customers. Each site
carries a stable identifier instead, and the map back to the code lives with
the product rather than here. What was judged, by which rule, and why a false
alarm was false is all in `test/precision.json` and can be argued with.

Three verdicts rather than two. A site can be a defect, a **deliberate** choice
the author made behind a comment and would not thank you for changing, or a
finding the tool should not have made. Only the last is a false alarm. Four
handlers that swallow a failure during application shutdown, each behind a
comment explaining why a failure there must not stop the shutdown, are the
reason the middle column exists.

**The top of the list is the worse half**: 6 false alarms in 20 against 3 in 20
further down. That is the opposite of what a top-of-the-list sample is usually
accused of, and it has one cause — rule 4 scores highest, and rule 4 holds every
false alarm.

| rule | random twenty | first twenty |
|---|---|---|
| `same-answer` | **3 of 7 false** | **6 of 10 false** |
| `swallowed` | 0 of 11 | 0 of 9 |
| `default-on-error` | 0 of 2 | 0 of 1 |
| `no-timeout` | reported nothing | reported nothing |

Two causes, both in rule 4:

* **A parameter guard is not the empty path.** `if (x == null) return null`
  answers a caller who asked a malformed question; colliding it with a `catch`
  that also answers `null` produces a finding about nothing. Five of the six
  false alarms in the first sample are this one.
* **A void method has no answer**, so its two paths cannot differ. Two findings
  reported a method for returning `undefined` on both paths, which every `void`
  method does.

**Both are fixed in 0.2.1**, and measured on two corpora rather than one. On the
twenty-one files the false alarms came from, rule 4 went from 14 findings to 8;
on the other ninety-six files of the same tree — which no verdict on this page
was ever read from — from 37 to 27. JavaScript did not move at all.

The correction was checked against the verdicts already recorded, one by one:
of the six rule 4 findings judged real, **none** was removed; of the seven judged
false, six were. The seventh kept its finding and re-anchored onto a real empty
path further down the same method, so it stopped being a false alarm rather than
disappearing. A correction that quietened rather than aimed would have shown up
there.

**None of which is a claim that precision improved.** Six false alarms out of
fourteen left the corpus and the eight that remain have not been read again. The
numbers in the table above were measured against the tool as it stood on
2026-09-21 and are kept at that date rather than adjusted; a figure for 0.2.1
needs a fresh sample, judged the same way, and none has been taken.

**Not one false alarm came from the tables.** No wrong family, no wrong
ambiguous value, no read that was not a read. The read table for Java was
written from a count of a real tree — `Files.*` 459 times, `.send` 16, every one
of them `HttpClient.send` — and three shapes a table written from memory would
have carried were left out because nothing in the material matched them.

Twenty checked at random out of eighty-nine is twenty checked. The other 53 are
unread, and nothing here claims otherwise.

Every verdict in all three measurements was reached by reading the code at the
cited line. The full record is in `test/precision.json`.

## What it does not do

* **It does not change files.** It prints a fix to paste, and the fix names the
  mechanism the neighbours already use — not a mechanism in general.
* **It does not judge a convention, only a deviation from one.** Where no
  neighbour does it the other way, nothing is reported. That silence is counted
  and named in the run header; it is never a blank.
* **It does not know whether a finding is a bug.** This class of tool has a
  published precision of 18.1% (PR-Miner). Read, judge, mute.
* **It does not read Python, Dart, Go or SQL.** JavaScript and TypeScript first,
  Java in 0.2.0, each after measuring — see
  [Why JavaScript first](#why-javascript-first).
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

Reproduce it from a clone — `test/fixtures/` ships with the repository, not
with the package:

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
| `scan <dir>` | run the four rules over a JavaScript, TypeScript or Java tree |
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
written; **five of the six were JavaScript or TypeScript** and reachable in real
material. The sixth is a SQL-migration checker and is recorded as out of
language scope rather than as missing — see `test/known-answers.mjs`. A seventh
answer, in Java, was added with 0.2.0.

Two further reasons, in order of weight:

* Rule 3 needs a population of reads that *mix* guarded and unguarded. In async
  JavaScript that population is dense and the mechanisms are recognisable:
  `AbortSignal.timeout`, an `AbortController` fired from a `setTimeout`,
  `Promise.race`, a `timeout:` option. In Java the same question is spread
  across a dozen unrelated APIs.

  **That prediction has since been measured, and it held.** On the Java tree
  above, rule 3 reported nothing at all: 78 external reads, and all 78 passed
  over for the same stated reason — not one layer anywhere in the tree has a
  deadline to deviate from. The rule went quiet, said so in the header, and was
  right to. A rule that had guessed instead would have reported 78 findings.
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
SQL tooling, and the suite refuses to call that a pass.

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
