// looks-clean — the parsers, and which vocabulary goes with each.
//
// ONE GRAMMAR FOR JAVASCRIPT AND TYPESCRIPT. TypeScript is a superset of
// JavaScript, so `tree-sitter-typescript` reads .js, .mjs, .cjs, .ts and .mts.
// Only JSX needs the separate tsx grammar: `<Foo />` is a syntax error under the
// plain one, and a file that fails to parse contributes no sites — which would
// show up as a smaller population and no message at all, i.e. exactly the silent
// zero this tool exists to find.
//
// JAVA IS A THIRD GRAMMAR AND A SECOND VOCABULARY. The grammar was the easy
// half: `tree-sitter-java` ships its own .wasm and loads through the same two
// calls. The half that matters is `syntaxFor` — a grammar with no entry in
// src/syntax/ parses the file perfectly and then answers "no" to every question
// the rules ask, which reads as a clean file. The two are returned together
// here so that adding one without the other is not something a caller can do.
//
// THE WASM PATH GOES THROUGH THE MODULE RESOLVER, not through the current
// working directory. Resolving it against cwd works only when the tool is
// started from its own directory — that is, never after `npm i -g`.
import { Parser, Language } from 'web-tree-sitter';
import { createRequire } from 'node:module';
import * as JS from './syntax/js.mjs';
import * as JAVA from './syntax/java.mjs';

const require = createRequire(import.meta.url);
const WASM = {
  ts: require.resolve('tree-sitter-typescript/tree-sitter-typescript.wasm'),
  tsx: require.resolve('tree-sitter-typescript/tree-sitter-tsx.wasm'),
  java: require.resolve('tree-sitter-java/tree-sitter-java.wasm'),
};

const SYNTAX = { ts: JS, tsx: JS, java: JAVA };

const cache = new Map();

async function get(kind) {
  if (cache.has(kind)) return cache.get(kind);
  await Parser.init();
  const lang = await Language.load(WASM[kind]);
  const p = new Parser();
  p.setLanguage(lang);
  cache.set(kind, p);
  return p;
}

/** Which grammar a file needs. .jsx and .tsx carry JSX; everything else does not. */
export function grammarFor(file) {
  if (/\.java$/i.test(file)) return 'java';
  return /\.(tsx|jsx)$/i.test(file) ? 'tsx' : 'ts';
}

/** Which node vocabulary reads this file's tree. */
export function syntaxFor(file) {
  return SYNTAX[grammarFor(file)];
}

export async function parserFor(file) {
  return get(grammarFor(file));
}

export { WASM as GRAMMAR_PATHS };
