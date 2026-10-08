/**
 * Which page each brand features on its home page and in its menu, by month.
 *
 * The pages themselves are live all year (content/seasonal and the service
 * pages); this only decides which one is put in front of people now. The
 * build picks one for the static fallback, and /assets/season.js picks again
 * in the visitor's browser, so the feature moves with the calendar without
 * anybody having to rebuild the site.
 *
 * First match wins. A month with no entry features nothing, and the menu item
 * hides rather than pointing at something out of season.
 *
 *   m      months it runs, 1 to 12
 *   href   the page
 *   label  the menu text, short
 *   text   one line for the home page
 */
export const seasons = {
  dampscan: [
    { m: [9, 10, 11, 12, 1, 2], href: '/seasonal/autumn-condensation-help', label: 'Condensation help', text: 'Mould appearing now the heating is on? What to do this week, and when a survey is worth it.' }
  ],
  ati: [
    { m: [9, 10, 11, 12, 1, 2], href: '/seasonal/autumn-condensation-help', label: 'Condensation help', text: 'Mould appearing now the heating is on? How to tell condensation from damp, and who is responsible.' }
  ],
  roofing: [
    { m: [9, 10], href: '/seasonal/winter-roof-checks', label: 'Winter roof checks', text: 'Get the roof checked before the winter storms find the weak spots.' },
    { m: [11, 12, 1, 2, 3], href: '/services/storm-damage', label: 'Storm damage', text: 'Tiles off or a leak after the wind? We make it safe fast and repair it properly.' },
    { m: [4, 5, 6, 7, 8], href: '/problems/moss-on-roof', label: 'Moss and gutters', text: 'Spring is the time to clear moss and gutters before they cause a leak.' }
  ],
  ac: [
    { m: [2, 3, 4], href: '/seasonal/air-con-servicing-before-summer', label: 'Spring servicing', text: 'Have your air con serviced now, before the first hot day finds the fault.' },
    { m: [5, 6, 7, 8], href: '/seasonal/summer-air-con-installation', label: 'Summer installs', text: 'Too hot to sleep? Get air conditioning quoted before the summer rush.' },
    { m: [9, 10, 11, 12, 1], href: '/services/air-to-air-heat-pumps', label: 'Heat pump heating', text: 'Your air con can heat the house too. How air to air heat pumps work in winter.' }
  ]
};
