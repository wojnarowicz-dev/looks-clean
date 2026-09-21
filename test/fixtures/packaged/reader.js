// looks-clean — material for the packaged layer, JavaScript half.
//
// Four reads of one family so a population and a convention both exist, and
// one of them breaking the convention so the run is not empty. An empty run
// would prove the package installs, and nothing about whether it works.
import { readFile } from 'node:fs/promises';

export async function loadConfig(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (e) {
    console.error('config unreadable', e);
    return null;
  }
}

export async function loadTheme(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (e) {
    console.error('theme unreadable', e);
    return null;
  }
}

export async function loadLocale(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (e) {
    console.error('locale unreadable', e);
    return null;
  }
}

// The odd one out: the same read, answering the same thing, with nothing left
// behind to say a failure happened.
export async function loadKeymap(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}
