// looks-clean — finding the files, and turning each one into sites.
//
// INLINE <script> IS READ. Pages keep JavaScript inside HTML, and in the
// material this tool was built against that is where most of the error handling
// lives. Skipping it would leave the scanner reporting a small, tidy number of
// findings on a project whose riskiest code it never opened — a clean-looking
// answer produced by not looking, which is the thing this tool is against.
//
// HTML COMMENTS ARE BLANKED FIRST. Without that, the word "<script>" written
// inside a comment — which is how pages get documented — is taken as an opening
// tag and paired with a closing tag a hundred lines later, so CSS and prose
// reach the parser as JavaScript. The comment body is replaced with spaces and
// the NEWLINES ARE KEPT, or every line number in the report drifts.
import fs from 'node:fs';
import path from 'node:path';
import { parserFor } from './parser.mjs';
import { tryReadSource } from './input.mjs';
import { analyse } from './ir.mjs';

const SCRIPT_EXT = /\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)$/i;
const HTML_EXT = /\.html?$/i;

export function collectFiles(dir, cfg, acc = { script: [], html: [] }) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    // A directory that cannot be listed is not silently skipped: everything
    // under it drops out of every population, and a smaller population produces
    // fewer findings, which reads as cleaner code.
    acc.unreadableDirs = acc.unreadableDirs || [];
    acc.unreadableDirs.push({ dir, code: e.code || e.message });
    return acc;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (cfg.isExcluded(p)) continue;
    if (e.isDirectory()) { collectFiles(p, cfg, acc); continue; }
    if (!e.isFile()) continue;
    if (HTML_EXT.test(e.name)) acc.html.push(p);
    else if (SCRIPT_EXT.test(e.name)) acc.script.push(p);
  }
  return acc;
}

// GENERATED AND BUNDLED FILES ARE NOT PART OF ANYBODY'S CONVENTION.
//
// The first real project this was run against shipped `supabase-js-2.112.4.js`
// — a 200 KB bundle on seven lines — beside the seventeen files somebody
// actually wrote. It contributed 105 "functions" and 4 "error handlers" to the
// population, and then supplied the NEIGHBOURS quoted in the report: three
// citations of `supabase-js-2.112.4.js:7`, offered to the reader as evidence
// about their own code. A comparison drawn against a minifier's output is
// worse than no comparison, because it looks like one.
//
// The test is the shape of the file, not its name. `*.min.js` catches some of
// them and misses every bundle that kept its own name — which is most of them.
// A line a thousand characters long was not written by hand.
const GENERATED_LINE = 1000;

function looksGenerated(src) {
  if (/\/\/[#@]\s*sourceMappingURL=/.test(src)) return 'source map comment';
  let longest = 0, start = 0;
  for (let i = 0; i <= src.length; i++) {
    if (i === src.length || src[i] === '\n') {
      if (i - start > longest) longest = i - start;
      if (longest >= GENERATED_LINE) return 'line of ' + longest + ' characters';
      start = i + 1;
    }
  }
  return null;
}

function blankOutHtmlComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
}

/** The inline script blocks of a page, each with the line it starts on. */
export function scriptsFromHtml(raw) {
  const src = blankOutHtmlComments(raw);
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=\s*["']/i.test(attrs)) continue;              // loaded from a file we read separately
    const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']*)["']/i);
    if (typeMatch) {
      const ty = typeMatch[1].toLowerCase();
      if (ty && !/javascript|module|ecmascript/.test(ty)) continue;   // ld+json and friends
    }
    const content = m[2];
    const before = src.slice(0, m.index + m[0].indexOf(content));
    out.push({ content, lineOffset: before.split('\n').length - 1 });
  }
  return out;
}

/**
 * Reads every file and returns the merged site lists.
 *
 * A file that will not parse is RECORDED, not dropped. Its sites are missing
 * from every population it should have joined, and the report has to be able to
 * say so — otherwise a syntax error in one large file quietly shrinks the
 * evidence behind every finding in its directory.
 */
export async function readProject(files, root, { includeGenerated = false } = {}) {
  const rel = f => path.relative(root, f).replace(/\\/g, '/') || path.basename(f);
  const all = { functions: [], handlers: [], reads: [] };
  const parseErrors = [];
  const generated = [];
  let filesRead = 0;
  let htmlBlocks = 0;

  for (const f of files.script) {
    const src = tryReadSource(f);
    if (src === null) continue;
    if (!includeGenerated) {
      const why = looksGenerated(src);
      if (why) { generated.push({ file: rel(f), why }); continue; }
    }
    filesRead++;
    const parser = await parserFor(f);
    const tree = parser.parse(src);
    const ir = analyse(tree, rel(f), 0);
    if (ir.hasParseError) parseErrors.push(rel(f));
    all.functions.push(...ir.functions);
    all.handlers.push(...ir.handlers);
    all.reads.push(...ir.reads);
  }

  for (const f of files.html) {
    const src = tryReadSource(f);
    if (src === null) continue;
    const blocks = scriptsFromHtml(src);
    if (!blocks.length) continue;
    filesRead++;
    const parser = await parserFor('page.ts');
    for (const b of blocks) {
      htmlBlocks++;
      const tree = parser.parse(b.content);
      const ir = analyse(tree, rel(f), b.lineOffset);
      if (ir.hasParseError && !parseErrors.includes(rel(f))) parseErrors.push(rel(f));
      all.functions.push(...ir.functions);
      all.handlers.push(...ir.handlers);
      all.reads.push(...ir.reads);
    }
  }

  return { ...all, filesRead, htmlBlocks, parseErrors, generated, rel };
}
