/* Barking and Dagenham. Housing stock notes are the point of this file: the shared framing
   around them lives in scripts/area-template.js. */
export default {
  slug: 'barking-and-dagenham',
  site: 'ati',
  name: 'Barking and Dagenham',
  metaDescription:
    'Independent damp and timber surveys across Barking and Dagenham, IG11, RM8, RM9 and RM10. Reports for owners, landlords, agents and disrepair cases.',
  h1: 'Independent damp surveys in Barking and Dagenham',
  intro:
    'Barking and Dagenham is dominated by one thing: the Becontree estate, built in the twenties and thirties and the largest council built estate in the world. Around twenty six thousand homes to a small number of repeating designs. That uniformity is unusual and genuinely useful, because a fault found in one house is very often present in its neighbours.',
  stock: [
    'The Becontree houses are cavity walled cottage estate homes with rendered or brick elevations, a functioning damp proof course and suspended timber ground floors over ventilated voids. A century on, they have been through right to buy, individual improvement and varying standards of maintenance, so the housing is uniform but its history is not. Ground level is the near universal issue: nine decades of paths, drives and patios laid over one another until the ground bridges the damp proof course.',
    'The second recurring fault is ventilation. Underfloor airbricks blocked by patios, extensions and render, and windows replaced without trickle vents. Because so many of these houses have had the same improvements at similar times, the same defects turn up street after street, and a survey on one address will often correctly predict the next.',
    'Barking town centre and the riverside add post-war and recent high density housing, with the airtight envelope and mechanical ventilation issues that come with newer construction, and the borough has a substantial private rented sector where disrepair reports need to distinguish building defects from occupation with measurements rather than opinion.',
  ],
  common: [
    'Ninety years of layered paths and drives bridging the damp proof course on Becontree housing',
    'Airbricks blocked by later patios, extensions and render',
    'Windows replaced without trickle vents, removing the ventilation the house relied on',
    'Timber decay at joist ends where an underfloor void has stopped being ventilated',
    'Housing disrepair reports that separate building defects from occupation',
    'Airtight recent flats with uncommissioned or disabled mechanical ventilation',
  ],
  coverage:
    'We survey across the borough, from Barking and the riverside out through Dagenham and the Becontree estate.',
  places: ['Barking', 'Dagenham', 'Becontree', 'Chadwell Heath', 'Rush Green', 'Marks Gate', 'Creekmouth', 'Castle Green', 'Goresbrook'],
  districts: ['IG11', 'RM8', 'RM9', 'RM10'],
  towns: [
    { name: 'Becontree', text: 'One of the largest interwar council estates ever built, now largely in mixed ownership. Cottage style houses with cavity or solid walls, many altered with replacement windows, render and extensions. Mould and condensation, failed render and bridged courses at the base of walls are what we usually find.' },
    { name: 'Barking town centre', text: 'Victorian terraces near the station alongside large recent developments and tower blocks. The terraces need their yards and rear additions looked at; the newer flats need their ventilation working.' },
    { name: 'Dagenham and the riverside', text: 'Post war housing and new developments near the Thames on low ground. Floors on the lowest streets can be affected by groundwater, and newer flats see construction moisture and ventilation issues.' }
  ],
  faq: [
    {
      q: 'Everyone in our street has the same damp. Is that a coincidence?',
      a:
        'On Becontree, almost certainly not. Thousands of these houses were built to the same handful of designs at the same time, so they share their construction, their damp proof course height and their underfloor ventilation arrangement. When a whole street has had drives and paths laid over the decades in a similar way, the same bridging fault appears in each. That is useful: the diagnosis is often quick and the remedy is the same modest external work rather than anything applied to the inside of the wall.'
    },
    {
      q: 'Our floorboards feel soft and the ground floor smells musty. What is that?',
      a:
        'It is most often the underfloor void having stopped being ventilated. These houses have suspended timber floors over a void that airbricks were meant to keep dry. Block those with a patio, an extension or render and the void becomes still and damp, the joist ends built into the wall stay wet, and decay follows. It is a serious finding because it is structural, and it is also usually cheap to arrest once identified.'
    },
    { q: 'Our Becontree house has rendered walls and damp inside. Is the render the problem?', a: 'It can be. Cracked or impermeable render holds water against the wall and stops it drying outwards. The survey checks the render closely and the pattern of damp inside.' },
    { q: 'Our flat in a new Barking development has mould. Who is responsible?', a: 'If ventilation is not working as designed or water is getting in at a detail, it may be a defect for the developer or managing agent. The report measures and records the cause.' },
    { q: 'Do you survey for tenants and landlords in Barking and Dagenham?', a: 'Yes. The report separates building defects from condensation, which helps landlords meet their duties and helps tenants show what needs fixing.' }
  ],
  nearby: ['havering', 'newham']
};
