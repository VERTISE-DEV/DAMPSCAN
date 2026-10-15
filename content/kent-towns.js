/**
 * The Kent town table that drives DampScan's town pages.
 *
 * Each town has two pages: /damp-survey/<slug> (the survey page, the main
 * one) and /damp-proofing/<slug> (the honest answer to "damp proofing
 * <town>": survey first, because we sell no treatment). The entries live one
 * per file in content/kent-towns/ so no file grows past a readable length.
 *
 * Every fact here should be broadly known and safe to state: housing eras,
 * walling materials, rivers and coast, named neighbourhoods. No statistics.
 *
 * Shape of an entry:
 *   slug, name           URL slug and the name people type
 *   district             the council district's area slug (content/areas/),
 *                        or the town's own slug where the town page is the
 *                        district page too
 *   material             the walling most associated with the place
 *   postcodes, places    postcode districts, and neighbourhoods and villages
 *   nearby               slugs of nearby towns, for links
 *   survey               { intro, stock[3], ground, causes[5], areas[3]{name,text}, buyers, faq[6] }
 *   proofing             { intro, oversold, walls, right[4], faq[6] }
 */
import { towns as list } from './kent-towns/index.js';
import { areas } from './areas/index.js';

/* Where a district still has its own page, a town in it links up to it. */
export const towns = list.map((t) => {
  const hub = t.district !== t.slug && areas.find((a) => a.site === 'dampscan' && a.slug === t.district);
  return { ...t, site: 'dampscan', districtHub: hub ? { slug: hub.slug, name: hub.name } : null };
});

/** Towns in one district, in table order. */
export function townsIn(district) {
  return towns.filter((t) => t.district === district);
}
