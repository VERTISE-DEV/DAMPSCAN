/**
 * Which wording each place page gets for each shared section.
 *
 * The framing around the local copy (what the survey covers, the report, the
 * process) is written in several versions. Picking a version per section at
 * random would still hand some pair of pages the same version of most
 * sections, and those two would read as copies. Instead the pages of one kind
 * get codes chosen so that any two differ in as many sections as possible:
 * a greedy search for the largest minimum distance that still yields enough
 * codes for every page. test/town-pages.test.js measures the result.
 */

function allCodes(base, length) {
  const out = [];
  const total = base ** length;
  for (let n = 0; n < total; n++) {
    const digits = [];
    let x = n;
    for (let i = 0; i < length; i++) { digits.push(x % base); x = Math.floor(x / base); }
    out.push(digits);
  }
  return out;
}

const distance = (a, b) => a.reduce((d, v, i) => d + (v === b[i] ? 0 : 1), 0);

/** `count` codes whose pairwise distance is as large as the space allows. */
function spread(count, base, length) {
  const pool = allCodes(base, length);
  for (let d = length; d >= 1; d--) {
    const chosen = [];
    for (const c of pool) {
      if (chosen.every((o) => distance(o, c) >= d)) chosen.push(c);
      if (chosen.length >= count) return chosen;
    }
  }
  return pool.slice(0, count);
}

const cache = new Map();

/**
 * The variant number for each of `length` sections, for page `index` of
 * `count` pages of one kind. Adding a page can reshuffle the others' wording,
 * which is harmless: the build regenerates them all.
 */
export function variantCode(index, base, length, count = 64) {
  const key = `${base}:${length}:${count}`;
  if (!cache.has(key)) cache.set(key, spread(Math.max(count, 1), base, length));
  const list = cache.get(key);
  return list[index % list.length];
}

/** Pick one of a section's versions for this page. */
export function pick(versions, code, section) {
  return versions[code[section] % versions.length];
}
