// looks-clean — which languages this build reads, stated once.
//
// WHY THIS FILE EXISTS. The list of languages was written out by hand in six
// places: the file matcher, two sentences of the dictionary, the argument of
// the "nothing to read" message, a known answer, and both pages. Adding Java
// updated four of them; adding Dart updated three and left three behind, and
// nobody noticed until the list was counted. One of the stragglers was a test
// expectation that could no longer match anything, sitting green because a
// sibling phrase matched in its place.
//
// None of those was a hard bug. Every one of them was the same small lie: a
// sentence telling a reader which languages were read, naming a set that was
// not the set. That is the defect this tool reports in other people's code,
// committed in the one file where it is read most.
//
// So this is the fact, and everything else is derived from it. A language
// added here appears in the matcher, in both pages of the help, in the message
// printed when nothing was found, and in the sentence a known answer uses to
// explain what is out of scope — without any of them being edited.
//
// NOTHING IS IMPORTED HERE. This module is a leaf on purpose: the dictionary,
// the collector and the scan all reach for it, and a dependency of its own
// would make a cycle out of a list.

/**
 * One row per language, in the order a reader should meet them.
 * `extensions` are what the collector matches; `name` is what a person reads.
 */
export const LANGUAGES = [
  { name: 'JavaScript', extensions: ['js', 'mjs', 'cjs', 'jsx'] },
  { name: 'TypeScript', extensions: ['ts', 'mts', 'cts', 'tsx'] },
  { name: 'Java', extensions: ['java'] },
  { name: 'Dart', extensions: ['dart'] },
];

/**
 * Pages are read for the script inside them rather than as a language of their
 * own, which is why they are named apart: a sentence about what is read has to
 * mention them, and a sentence about languages must not.
 */
export const PAGE_EXTENSIONS = ['html', 'htm'];

export const SOURCE_EXTENSIONS = LANGUAGES.flatMap(l => l.extensions);

/** The matcher the collector uses. Built, so it cannot disagree with the list. */
export const SOURCE_EXT = new RegExp('\\.(' + SOURCE_EXTENSIONS.join('|') + ')$', 'i');
export const PAGE_EXT = new RegExp('\\.(' + PAGE_EXTENSIONS.join('|') + ')$', 'i');

/** `.js .mjs .cjs .jsx .ts .mts .tsx .java .dart` — for the sentence about what is read. */
export const extensionsSpaced = () => SOURCE_EXTENSIONS.map(e => '.' + e).join(' ');

/** `.html .htm` — the pages read for the script inside them. */
export const pagesSpaced = () => PAGE_EXTENSIONS.map(e => '.' + e).join(' ');

/** `.js/.ts/.java/.dart/.html` — one extension per language, plus pages. */
export const extensionsShort = () =>
  [...LANGUAGES.map(l => '.' + l.extensions[0]), '.' + PAGE_EXTENSIONS[0]].join('/');

/**
 * `JavaScript, TypeScript, Java or Dart`. The conjunction is a parameter
 * because the two pages of this tool do not share one.
 */
export const languagesJoined = (conjunction = 'or') => {
  const names = LANGUAGES.map(l => l.name);
  if (names.length < 2) return names.join('');
  return names.slice(0, -1).join(', ') + ' ' + conjunction + ' ' + names[names.length - 1];
};
