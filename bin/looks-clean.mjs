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
import { firstPositional } from '../src/args.mjs';
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

if (cmd === 'diff') {
  const { readSnapshot, printDiff } = await import(mod('snapshot.mjs'));
  // `--lang` eats the token after it, exactly as `--top` does under `rank`.
  const files = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--lang') { i++; continue; }
    if (rest[i].startsWith('--')) continue;
    files.push(rest[i]);
  }
  if (files.length !== 2) {
    console.error(t('diffNeedsTwo'));
    process.exit(2);
  }
  const d = printDiff(readSnapshot(files[0]), readSnapshot(files[1]),
    { showUnchanged: rest.includes('--all') });
  // The exit code carries information for CI: 1 = there are new findings.
  process.exit(d.nowe.length ? 1 : 0);
}

if (cmd === 'rank') {
  const { readSnapshot } = await import(mod('snapshot.mjs'));
  const { printRanking } = await import(mod('rank.mjs'));
  // Value-taking flags eat the token after them. Without this, `--top 8` puts
  // "8" on the list of snapshot files and the run dies reading it.
  const VALUE = new Set(['--top', '--lang']);
  const files = [];
  let top = 20;
  for (let i = 0; i < rest.length; i++) {
    if (VALUE.has(rest[i])) {
      if (rest[i] === '--top') top = +rest[i + 1] || 20;
      i++; continue;
    }
    if (rest[i].startsWith('--')) continue;
    files.push(rest[i]);
  }
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
