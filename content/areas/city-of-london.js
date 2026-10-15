/* City of London. Housing stock notes are the point of this file: the shared framing
   around them lives in scripts/area-template.js. */
export default {
  slug: 'city-of-london',
  site: 'ati',
  name: 'City of London',
  metaDescription:
    'Independent damp and timber surveys in the City of London, EC1 to EC4. Reports for leaseholders, owners and managing agents.',
  h1: 'Independent damp surveys in City of London',
  intro:
    'The City has few homes and they are unlike anything else in London: the Barbican and Golden Lane estates, a scattering of Victorian and Edwardian mansion flats, and a growing number of converted office buildings. Concrete, listed status and shared building services define the problems here rather than brick and ground level.',
  stock: [
    'The Barbican is Grade II listed concrete, and that combination is unusual and constraining. Exposed board marked concrete cannot be treated, coated or altered without consent, and the estate has its own standards for what may be done inside a flat as well as outside. Concrete is also thermally conductive, so cold bridging at slabs, columns and window surrounds is inherent to the construction rather than a defect in the ordinary sense, and the answer is heating, ventilation and internal detail rather than anything applied to the structure.',
    'The mansion flats bring shared parapets, valley gutters, lightwells and long communal stacks, and the water that enters at roof level appears several floors below and often several flats along. In a building with a single freeholder and dozens of leaseholders, establishing the path of the water is what determines whose service charge pays for the repair.',
    'The office to residential conversions are the newest stock and the least tested. Deep floorplates, extensive glazing, mechanical ventilation and layouts that were never designed for domestic moisture loads. Where ventilation was specified for an office and is now serving kitchens and bathrooms, condensation follows and it is a design outcome rather than a resident failing.',
  ],
  common: [
    'Cold bridging at slabs, columns and window surrounds in listed concrete construction',
    'Listing constraints ruling out coatings and alterations that would be routine elsewhere',
    'Mansion block leaks entering at parapet level and appearing several floors down',
    'Service charge disputes needing an independent view of where the defect actually is',
    'Office to residential conversions with ventilation never designed for domestic moisture',
    'Lightwell and internal courtyard drainage that nobody has inspected in years',
  ],
  coverage:
    'We survey residential property throughout the City and the streets immediately around it.',
  places: ['Barbican', 'Golden Lane', 'Smithfield', 'Blackfriars', 'Aldgate', 'Farringdon', 'Fleet Street', 'Moorgate', 'Bank'],
  districts: ['EC1', 'EC2', 'EC3', 'EC4'],
  towns: [
    { name: 'The Barbican and Golden Lane', text: 'Large post war residential estates with concrete frames, podiums and many flats. Damp here is usually from podium and roof waterproofing, balcony details or condensation on cold concrete, and responsibility often sits with the estate management rather than the flat.' },
    { name: 'Clerkenwell edge and Smithfield', text: 'Older warehouses and commercial buildings converted into flats. Thick brick walls, old roofs and shared drainage are the recurring themes, along with basements that were never designed to be lived in.' },
    { name: 'Riverside and the eastern City', text: 'Modern blocks and conversions near the Thames and towards Aldgate. Mechanical ventilation, construction moisture in newer buildings and leaks from roof terraces are what we are typically asked to look at.' }
  ],
  faq: [
    {
      q: 'Can anything be done about condensation in a listed concrete flat?',
      a:
        'Yes, though not by altering the concrete. Listing rules out coatings, cladding and most visible intervention, so the work has to be done through heating, ventilation and internal detail: keeping surface temperatures above dew point where it matters, providing ventilation that actually moves the air it is rated for, and treating the specific cold spots rather than the whole envelope. A report that recommends insulating the structure is a report that will be refused consent.'
    },
    {
      q: 'Water is coming into our flat from the common parts. Where does that leave us?',
      a:
        'In a stronger position than it feels, provided the path is documented. Roofs, parapets, valley gutters, lightwells and communal stacks are normally the freeholder\'s responsibility and are funded through the service charge. What is missing in most of these disputes is not goodwill but evidence about where the water is actually entering. Our report supplies that, with readings and photographs, which is what turns a complaint into a repair instruction.'
    },
    { q: 'Our Barbican flat has damp near the balcony. Is that ours to fix?', a: 'Balconies, podiums and the external envelope on large estates are commonly the responsibility of the estate or freeholder. The report identifies whether the water is coming through those elements.' },
    { q: 'Do you survey commercial buildings in the City?', a: 'We survey residential properties and mixed use buildings where flats are affected. For purely commercial premises, ask and we will say whether we can help.' },
    { q: 'Our converted warehouse flat has condensation on the windows every morning. Is that normal?', a: 'Some is normal in cold weather. Heavy, daily condensation with mould suggests too little ventilation for the moisture produced. We measure and report what will make the biggest difference.' }
  ],
  nearby: ['westminster', 'islington']
};
