// looks-clean — the shared JavaScript/TypeScript parser.
//
// ONE GRAMMAR FOR BOTH LANGUAGES. TypeScript is a superset of JavaScript, so
// `tree-sitter-typescript` reads .js, .mjs, .cjs, .ts and .mts. Only JSX needs
// the separate tsx grammar: `<Foo />` is a syntax error under the plain one,
// and a file that fails to parse contributes no sites — which would show up as
// a smaller population and no message at all, i.e. exactly the silent zero this
// tool exists to find.
//
// THE WASM PATH GOES THROUGH THE MODULE RESOLVER, not through the current
// working directory. Resolving it against cwd works only when the tool is
// started from its own directory — that is, never after `npm i -g`.
import { Parser, Language } from 'web-tree-sitter';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const WASM = {
  ts: require.resolve('tree-sitter-typescript/tree-sitter-typescript.wasm'),
  tsx: require.resolve('tree-sitter-typescript/tree-sitter-tsx.wasm'),
};

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
  return /\.(tsx|jsx)$/i.test(file) ? 'tsx' : 'ts';
}

export async function parserFor(file) {
  return get(grammarFor(file));
}

export { WASM as GRAMMAR_PATHS };
