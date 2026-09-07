// looks-clean — input validation and source reading, one place.
//
// WHY THIS IS ITS OWN LAYER. A non-existent path is the commonest mistake a
// person makes with a scanner: a typo, a path copied from another machine, a
// project that moved. Without this check the run dies with a raw ENOENT and a
// Node stack trace, which reads as "the tool crashed" rather than "you mistyped
// a path". The check lives in the dispatcher and runs before anything is
// parsed, so exiting here is safe — no wasm module is loaded yet.
//
// Exit code 2 — "your input is the problem". Codes 0 and 1 belong to the
// analysis result (nothing new / there is something new), so a usage error
// needs one of its own.
import fs from 'node:fs';
import { t } from './lang.mjs';

const USAGE_ERROR_CODE = 2;

function fail(message, hint) {
  console.error(message);
  if (hint) console.error(hint);
  process.exit(USAGE_ERROR_CODE);
}

/** The path must exist and be a directory we can list. */
export function requireDirectory(pathArg, label) {
  if (!pathArg) fail(t('inputMissingArg', label));
  let st;
  try {
    st = fs.statSync(pathArg);
  } catch (e) {
    if (e.code === 'ENOENT') fail(t('inputNoSuchPath', pathArg), t('inputHintPath'));
    fail(t('inputUnreadable', pathArg, e.code), t('inputHintPath'));
  }
  if (!st.isDirectory()) fail(t('inputNotDir', pathArg), t('inputHintDir'));
  try {
    fs.readdirSync(pathArg);
  } catch (e) {
    fail(t('inputUnreadable', pathArg, e.code), t('inputHintPath'));
  }
  return pathArg;
}

/** The path must exist, be a regular file, and be readable. */
export function requireFile(pathArg, label) {
  if (!pathArg) fail(t('inputMissingArg', label));
  let st;
  try {
    st = fs.statSync(pathArg);
  } catch (e) {
    if (e.code === 'ENOENT') fail(t('inputNoSuchPath', pathArg), t('inputHintPath'));
    fail(t('inputUnreadable', pathArg, e.code), t('inputHintPath'));
  }
  if (!st.isFile()) fail(t('inputNotFile', pathArg), t('inputHintFile'));
  try {
    fs.accessSync(pathArg, fs.constants.R_OK);
  } catch (e) {
    fail(t('inputUnreadable', pathArg, e.code), t('inputHintPath'));
  }
  return pathArg;
}

// ------------------------------------------------------------------ reading

// WHY EVERY SOURCE GOES THROUGH ONE READER.
//
// Node's utf8 decoding never fails: a byte that is not valid UTF-8 becomes
// U+FFFD and the read succeeds. A file saved in cp1250 therefore parses, reports
// no error, and the run says nothing at all — while the text analysed is not the
// text in the file. That is this tool's own subject: the failure arrives wearing
// the clothes of a clean result.
//
// The decode is NOT refused — a project with one badly saved file should still
// be analysable. It is reported once, at the end of the run, naming the files.
//
// `buf.toString('utf8')` stays the returned value on purpose. Decoding through
// TextDecoder instead would strip a BOM and shift every offset by one character,
// moving line numbers and therefore fingerprints. The strict decoder below only
// ANSWERS THE QUESTION "was this valid UTF-8"; it never supplies the text.
const strict = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const notUtf8 = [];
const unreadable = [];

/** Reads a source file, and remembers if it was not valid UTF-8. */
export function readSource(file) {
  const buf = fs.readFileSync(file);
  try {
    strict.decode(buf);
  } catch {
    if (!notUtf8.includes(file)) notUtf8.push(file);
  }
  return buf.toString('utf8');
}

/**
 * Reads a source file, or records WHY it could not be read and returns null.
 *
 * A file the scanner cannot open must not vanish quietly: it would shrink every
 * population it belonged to, and a smaller population produces fewer findings —
 * which looks exactly like cleaner code.
 */
export function tryReadSource(file) {
  try {
    return readSource(file);
  } catch (e) {
    unreadable.push({ file, code: e.code || e.message });
    return null;
  }
}

export function nonUtf8Files() { return notUtf8.slice(); }
export function unreadableFiles() { return unreadable.slice(); }

/** One sentence at the end of a run, or nothing at all. */
export function reportNonUtf8(rel = (p => p)) {
  if (notUtf8.length === 0) return;
  const shown = notUtf8.slice(0, 5).map(rel);
  const more = notUtf8.length > 5 ? ', ...' : '';
  console.log('');
  console.log(t('nonUtf8Files', notUtf8.length, shown.join(', ') + more));
}

/** The same for files that could not be opened at all. */
export function reportUnreadable(rel = (p => p)) {
  if (unreadable.length === 0) return;
  console.log('');
  for (const u of unreadable.slice(0, 5))
    console.log(t('inputUnreadable', rel(u.file), u.code));
  if (unreadable.length > 5) console.log(t('andMore', unreadable.length - 5));
}
