#!/usr/bin/env node
// looks-clean — one entry point.
//
// `scan` is a module that reads process.argv on import, so the dispatcher swaps
// argv and imports it. That keeps the detector runnable on its own
// (`node src/scan.mjs ./src`) as well as through this command, which matters
// when something goes wrong and the layer above is the suspect.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { t } from '../src/lang.mjs';
import { firstPositional, valueOf, VALUE_FLAGS } from '../src/args.mjs';
import { RULE_IDS, NEEDS_POPULATION } from '../src/rules/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src');
const mod = f => new URL('file://' + path.join(SRC, f).replace(/\\/g, '/')).href;

const COMMANDS = {
  scan: {
    module: 'scan.mjs',
    arg: '<js-or-ts-dir>',
    descKey: 'cmdScan',
    options: '--rule ' + RULE_IDS.join(',') + '  --layer file|dir|root  --minpop 3  --top 15  --verbose  --json <file>  --all',
  },
  diff: { module: null, arg: '<previous.json> <current.json>', descKey: 'cmdDiff', options: '--all (also show unchanged findings)' },
  rank: { module: null, arg: '<run.json> [more.json...]', descKey: 'cmdRank', options: '--top 20' },
  rules: { module: null, arg: '', descKey: 'cmdRules', options: null },
};

const { help, rules: rulesScreen } = await import(new URL('./usage.mjs', import.meta.url).href);
const usage = (code = 0) => help(COMMANDS, code);

const [cmd, ...rest] = process.argv.slice(2);

if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') usage(0);
if (cmd === '--version' || cmd === '-v') {
  const { createRequire } = await import('node:module');
  console.log(createRequire(import.meta.url)('../package.json').version);
  process.exit(0);
}
if (!COMMANDS[cmd]) {
  console.error(t('unknownCommand', cmd));
  console.error('');
  usage(2);
}

if (cmd === 'rules') rulesScreen(RULE_IDS, NEEDS_POPULATION);

if (rest.length === 0) {
  console.error(t('inputMissingArg', cmd + ' ' + COMMANDS[cmd].arg));
  process.exit(2);
}

// THE POSITIONAL ARGUMENTS OF `diff` AND `rank` ARE FOUND WITH THE SAME LIST
// THE SCAN USES, and that is a correction rather than tidiness.
//
// Both commands carried their own hand-written set of value-taking flags. Both
// sets were short: `diff` knew about `--lang`, `rank` about `--top` and
// `--lang`, and neither knew about `--config`. So `rank run.json --config x.json`
// put `x.json` on the list of snapshots to read, the read failed, and the
// command exited 2 — reported by the README gate, which runs every command the
// documentation shows.
//
// One list, in src/args.mjs, and a new value-taking flag has one place to be
// added rather than three.
const positionals = (argv) => {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      if (VALUE_FLAGS.has(a.slice(2))) i++;
      continue;
    }
    out.push(a);
  }
  return out;
};

if (cmd === 'diff') {
  const { readSnapshot, printDiff } = await import(mod('snapshot.mjs'));
  const files = positionals(rest);
  if (files.length !== 2) {
    console.error(t('diffNeedsTwo'));
    process.exit(2);
  }
  const d = printDiff(readSnapshot(files[0]), readSnapshot(files[1]),
    { showUnchanged: rest.includes('--all') });
  // The exit code carries information for CI: 1 = there are new findings.
  process.exit(d.added.length ? 1 : 0);
}

if (cmd === 'rank') {
  const { readSnapshot } = await import(mod('snapshot.mjs'));
  const { printRanking } = await import(mod('rank.mjs'));
  const files = positionals(rest);
  const top = +valueOf(rest, 'top', 20) || 20;
  if (files.length === 0) {
    console.error(t('rankNeedsOne'));
    process.exit(2);
  }
  const snaps = [];
  for (const f of files) {
    // A SNAPSHOT THAT WILL NOT READ STOPS THE COMMAND. Skipping it and ranking
    // the rest would print a shorter list with no explanation — a smaller
    // number that reads as an improvement.
    try {
      snaps.push(readSnapshot(f));
    } catch (e) {
      console.error(t('snapshotUnreadable', f, e.code || e.message));
      process.exit(2);
    }
  }
  printRanking(snaps, { top });
  process.exit(0);
}

// INPUT VALIDATION — one place, before anything is parsed. Without it a
// non-existent path produces a raw ENOENT with a stack trace, which reads as
// "the tool crashed" rather than "you mistyped a path". It is safe to exit here
// because no wasm grammar has been loaded yet.
{
  const { requireDirectory } = await import(mod('input.mjs'));
  requireDirectory(firstPositional(rest), COMMANDS[cmd].arg);
}

process.argv = [process.argv[0], path.join(SRC, COMMANDS[cmd].module), ...rest];
await import(mod(COMMANDS[cmd].module));
