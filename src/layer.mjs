// looks-clean — the neighbours.
//
// THIS IS THE MODULE THE TOOL EXISTS FOR. A linter carries its judgement with
// it: an empty catch is bad wherever it is found. Everything here is the
// opposite — nothing is bad in itself; a site is reported because the sites
// AROUND IT, doing the same job at the same level, do it differently.
//
// WHAT A LAYER IS. Two sites are neighbours when they are in the same place and
// belong to the same family of operation. Both halves matter:
//
//   * Same place. `saveDream` and `saveProfile` sitting in one service file are
//     written by the same hand for the same caller under the same constraints.
//     If one has a deadline and the other has none, that is a difference
//     somebody has to have decided, and most of the time nobody did.
//   * Same kind. A `fetch` and a `JSON.parse` are not comparable. Grouping them
//     would produce a "convention" nobody holds, and deviation from it would be
//     noise.
//
// THE LADDER, AND WHY IT STOPS WHERE THE READER PUT IT.
//
//   --layer file (default)  the file, then the directory
//   --layer dir             the directory, then the whole scanned tree
//   --layer root            the whole scanned tree
//
// Real projects are not uniform: one file has eleven supabase calls and the
// next has two. Fixing the layer at "file" leaves the second file with a group
// of two, no comparison possible, and no finding — reported as nothing to see.
// So a group too small to speak is retried one rung out.
//
// The whole tree is a real layer for some projects and a meaningless one for
// others, so it is never reached by accident. On a tree of Deno edge functions
// — one file per directory — the first version of this found nothing at all:
// every file held one `fetch`, every directory held one file, and three
// unguarded fetches never met the four guarded ones a directory away. That rung
// exists because that tree exists. It stays behind an explicit flag because at
// project scale "9 of 400 reads have a deadline" is a fact about the codebase
// rather than about this call, and every site becomes a deviation from
// everything else.
//
// WHICHEVER RUNG SPOKE IS PRINTED WITH THE FINDING. A comparison whose scope
// the reader cannot see is a comparison they cannot check.
import path from 'node:path';

const dirOf = f => {
  const d = path.dirname(String(f)).replace(/\\/g, '/');
  return d === '.' ? '.' : d;
};

// A group key no real path can collide with. It carries the NUL that the
// snapshot fingerprint uses as a separator, for the same reason: a path can
// contain a space, a slash or a colon, and none of them can contain this.
const ROOT_KEY = String.fromCharCode(0) + 'root';

/**
 * @param sites   the sites to group
 * @param keyOf   the family discriminator for a site; a site whose key is null
 *                has no comparable kind and is never grouped
 * @param minpop  the smallest group allowed to speak
 * @param mode    'file' | 'dir' | 'root' — the first rung of the ladder
 */
export function groupPeers(sites, { keyOf, minpop = 3, mode = 'file' } = {}) {
  const byFile = new Map();
  const byDir = new Map();
  const byRoot = new Map();

  const add = (map, k, s) => {
    let a = map.get(k);
    if (!a) { a = []; map.set(k, a); }
    a.push(s);
  };

  for (const s of sites) {
    const disc = keyOf(s);
    if (disc === null || disc === undefined) continue;
    s._disc = disc;
    add(byFile, s.file + ' ' + disc, s);
    add(byDir, dirOf(s.file) + ' ' + disc, s);
    add(byRoot, ROOT_KEY + ' ' + disc, s);
  }

  const FIRST = mode === 'root' ? 2 : mode === 'dir' ? 1 : 0;
  const LAST = mode === 'file' ? 1 : 2;      // 'file' never climbs to the root rung

  /**
   * The narrowest group at or above the starting rung that reaches minpop, or
   * the widest one available with `tooFew` set. Never returns null for a site
   * that has a discriminator: a site the tool declined to judge must be able to
   * say so, because "passed over" and "checked and fine" must not look alike.
   */
  function peersOf(site) {
    const disc = site._disc;
    if (disc === null || disc === undefined) return null;

    const rungs = [
      { members: byFile.get(site.file + ' ' + disc) || [], kind: 'file', name: site.file },
      { members: byDir.get(dirOf(site.file) + ' ' + disc) || [], kind: 'dir', name: dirOf(site.file) + '/' },
      { members: byRoot.get(ROOT_KEY + ' ' + disc) || [], kind: 'root', name: 'the scanned tree' },
    ].slice(FIRST, LAST + 1);

    for (const r of rungs) if (r.members.length >= minpop) return { ...r, disc, tooFew: false };

    const widest = rungs.reduce((a, b) => (b.members.length > a.members.length ? b : a), rungs[0]);
    return { ...widest, disc, tooFew: true };
  }

  return { peersOf, byFile, byDir, byRoot };
}

/** How a layer is named in the report: the rung, then what it covers. */
export function layerLabel(peers, t) {
  if (peers.kind === 'root') return t('layerRoot');
  return (peers.kind === 'dir' ? t('layerDir') : t('layerFile')) + ' ' + peers.name;
}
