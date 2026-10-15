/**
 * How the area pages are grouped and which ones lead.
 *
 * `groups` is what the areas hub is laid out by, so a reader in Sidcup finds
 * south east London without scanning an alphabetical list of thirty boroughs.
 *
 * `top` is the order the busiest pages are linked in from the home page and the
 * service pages. It follows Search Console impressions (last three months to
 * October 2026): these are the pages Google already shows, sitting at
 * positions 30 to 50, and more internal links is the cheapest lift available.
 * Re-sort it when the data moves; nothing else depends on the order.
 */
export const areaGroups = {
  dampscan: {
    groups: [
      { name: 'West Kent and Medway', slugs: ['dartford', 'gravesham', 'medway', 'maidstone', 'sevenoaks', 'tonbridge-and-malling', 'tunbridge-wells'] },
      { name: 'East Kent', slugs: ['ashford', 'canterbury', 'dover', 'folkestone-and-hythe', 'swale', 'thanet'] },
      { name: 'Surrey and Sussex', slugs: ['guildford', 'brighton'] }
    ],
    top: ['guildford', 'sevenoaks', 'dover', 'medway', 'dartford', 'tunbridge-wells', 'brighton', 'maidstone']
  },
  ati: {
    groups: [
      { name: 'Central London', slugs: ['camden', 'city-of-london', 'islington', 'kensington-and-chelsea', 'lambeth', 'southwark', 'westminster'] },
      { name: 'North London', slugs: ['barnet', 'enfield', 'haringey'] },
      { name: 'East London', slugs: ['barking-and-dagenham', 'hackney', 'havering', 'newham', 'redbridge', 'tower-hamlets', 'waltham-forest'] },
      { name: 'South East London', slugs: ['bexley', 'bromley', 'greenwich', 'lewisham'] },
      { name: 'South West London', slugs: ['croydon', 'kingston-upon-thames', 'merton', 'richmond-upon-thames', 'sutton', 'wandsworth'] },
      { name: 'West London', slugs: ['brent', 'ealing', 'hammersmith-and-fulham', 'harrow', 'hillingdon', 'hounslow'] }
    ],
    top: ['kensington-and-chelsea', 'croydon', 'islington', 'havering', 'hackney', 'bromley', 'barnet', 'camden']
  }
};

/** The top areas for a site, as area objects, in priority order. */
export function topAreas(site, areas, n = 8) {
  const g = areaGroups[site];
  if (!g) return [];
  return g.top
    .map((slug) => areas.find((a) => a.site === site && a.slug === slug))
    .filter(Boolean)
    .slice(0, n);
}
