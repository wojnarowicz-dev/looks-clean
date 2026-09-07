// looks-clean — command-line argument reading, one implementation.
//
// Taken from odd-one-out, where nine files reached into `process.argv` on their
// own before this existed. It is copied rather than re-derived because its
// oddities are load-bearing and were each paid for once already:
//   * a flag with no value yields `true`, not an empty string;
//   * a value beginning with `--` counts as ABSENT, so `--rule --top 5` reads
//     as "--rule with no value" rather than swallowing the next flag.
//
// NO IMPORTS, on purpose: `lang.mjs` needs this module to read `--lang`, so
// anything imported here would risk a cycle.

/** The classic `flag(name, default)` reader over a given argv. */
export function makeFlag(argv) {
  return (name, def) => {
    const i = argv.indexOf('--' + name);
    if (i < 0) return def;
    const v = argv[i + 1];
    return v === undefined || v.startsWith('--') ? true : v;
  };
}

/** All values of a repeatable flag. Collecting stops at the next `--flag`. */
export function flagAll(argv, name) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--' + name) {
      let j = i + 1;
      while (j < argv.length && !argv[j].startsWith('--')) out.push(argv[j++]);
    }
  }
  return out;
}

/**
 * A single value, or `fallback` when the flag is missing or has no value.
 * Unlike `flag`, a valueless flag does NOT become `true` here — this is the
 * reader for `--config`, `--lang` and `--json`, where `true` would be a path.
 */
export function valueOf(argv, name, fallback = null) {
  const i = argv.indexOf('--' + name);
  if (i < 0) return fallback;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : fallback;
}

/** Presence of a valueless switch, e.g. `--all`. */
export function hasFlag(argv, name) {
  return argv.includes('--' + name);
}

/**
 * Every flag that consumes the token after it. The dispatcher needs this to
 * tell a value from a path: without the list, `--top 8` made `8` the scanned
 * directory and the run died as a usage error, which moves no count in any
 * report and is therefore invisible in the numbers. A new value-taking flag
 * MUST be added here.
 */
export const VALUE_FLAGS = new Set([
  'json', 'lang', 'config', 'rule', 'top', 'layer', 'minpop', 'age', 'ext',
]);

/** The first positional argument: the first token that is neither a flag nor a flag's value. */
export function firstPositional(argv, valueFlags = VALUE_FLAGS) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      if (valueFlags.has(a.slice(2))) i++;
      continue;
    }
    return a;
  }
  return undefined;
}
