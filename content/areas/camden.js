/* Camden. Housing stock notes are the point of this file: the shared framing
   around them lives in scripts/area-template.js. */
export default {
  slug: 'camden',
  site: 'ati',
  name: 'Camden',
  metaDescription:
    'Independent damp and timber surveys across Camden, NW1, NW3, NW5 and WC1. Reports for buyers, owners, leaseholders and solicitors.',
  h1: 'Independent damp surveys in Camden',
  intro:
    'Camden runs from Georgian stucco terraces around Regent\'s Park up to the hill at Hampstead, and takes in a great deal of purpose built mansion block on the way. The three have almost nothing in common structurally, and the mistake we are most often asked to unpick is a diagnosis borrowed from one and applied to another.',
  stock: [
    'The stucco fronted terraces are solid brick behind a lime and later cement render. Stucco is a maintenance item, not a finish: once it cracks or blows, water gets behind it and stays there, and the render then holds it against the brick. Repainting over a blown section with a modern impermeable masonry paint is one of the most reliable ways to make a damp wall worse, and we see the result of it regularly.',
    'The mansion blocks bring parapets, valley gutters, lightwells and long shared soil and rainwater stacks. Water entering at roof level in a mansion block can appear three floors down and two flats along, which makes it an expensive argument between leaseholders and the freeholder unless somebody establishes the actual path. That is normally why we are instructed on a block: not to say there is damp, but to say where it is coming from and whose repairing obligation covers it.',
    'Hampstead and the higher ground bring the London clay and the slope with them. Retaining walls, split level rear gardens and basements cut into a hillside all produce lateral water pressure against a wall that was never built to resist it. Damp on the uphill wall of a lower ground room is a drainage question, and it is answered by looking at what is happening outside, not by injecting the inside.',
  ],
  common: [
    'Blown or cracked stucco holding water against solid brick, made worse by an impermeable masonry paint',
    'Water entering a mansion block at parapet or valley level and presenting several floors below',
    'Leaseholder and freeholder disputes needing an independent view on where the defect actually is',
    'Damp on the uphill wall of a lower ground room where the garden retains water against the structure',
    'Timber decay behind panelling and in joist ends in period property where nobody has opened anything up',
    'Pre purchase surveys on listed and locally listed buildings where invasive investigation is limited',
  ],
  coverage:
    'We survey the borough and the surrounding streets, from Bloomsbury and Kings Cross up through Camden Town to Hampstead and Highgate.',
  places: ['Camden Town', 'Hampstead', 'Kentish Town', 'Belsize Park', 'Primrose Hill', 'Bloomsbury', 'Kings Cross', 'Gospel Oak', 'Swiss Cottage'],
  districts: ['NW1', 'NW3', 'NW5', 'NW6', 'N6', 'WC1'],
  towns: [
    { name: 'Hampstead and Belsize Park', text: 'Large Victorian houses on the slopes of the hill, many divided into flats, alongside Georgian cottages in the old village and mansion blocks. The sands and gravels on top of the hill sit on London clay, and springs emerge where they meet. Basements and lower ground floors on the uphill side of a house retain ground that can be wet for months, and the damp in them is lateral rather than rising.' },
    { name: 'Camden Town, Kentish Town and Primrose Hill', text: 'Stucco fronted and plain brick terraces from the early and mid nineteenth century, almost all now flats. Front areas with vaults under the pavement, closet wings at the rear and shared roofs and soil stacks are where the water comes from. In converted houses, the flat with the damp is frequently not the flat with the defect.' },
    { name: 'Bloomsbury and Kings Cross', text: 'Georgian terraces around the squares, many in institutional or office use with flats above, and large Victorian and modern developments around the stations. Parapet gutters, valley roofs and lightwells are recurring sources of damp, and listed building constraints shape what can be recommended.' }
  ],
  faq: [
    {
      q: 'Who is responsible for damp in a mansion block flat?',
      a:
        'It depends on where the water is getting in and what the lease says, which is precisely why the survey is worth having before the argument. Roofs, parapets, valley gutters, external walls and shared stacks are normally the freeholder\'s responsibility; what is inside your demise is normally yours. Our report records the entry point and the path the water takes, so the question becomes a documented one rather than a matter of opinion between neighbours.'
    },
    {
      q: 'Can you survey a listed building without opening anything up?',
      a:
        'Yes, and in most cases that is the point. A great deal can be established without intervention: calibrated moisture readings across a grid, thermal patterns, drainage and ground level inspection outside, roof and rainwater goods, and the internal environment. Where something genuinely cannot be resolved without opening up, we say so and say exactly what needs opening and where, so you can seek consent for the smallest possible intervention rather than the largest.'
    },
    { q: 'Our Hampstead flat is damp only in winter. Why?', a: 'Seasonal damp on the hill often follows the water table in the sands and gravels, which rises through the winter and drops in summer. It reaches walls that retain ground on the uphill side. Condensation is also worse in winter, so the survey separates the two with readings and the pattern of the damp.' },
    { q: 'Do you survey mansion flats in Camden?', a: 'Yes, often for buyers and for leaseholders in dispute with a freeholder. Mansion blocks have shared roofs, gutters, soil stacks and heating pipes, and a damp patch in one flat is often the visible end of a defect elsewhere. The report traces it back.' },
    { q: 'Is a listed Bloomsbury building harder to survey?', a: 'Not harder, but the recommendations are different. The report focuses on repairs that suit historic fabric and are likely to be acceptable, such as lime repairs, rainwater work and drainage, and notes where consent would be needed.' }
  ],
  nearby: ['islington', 'hackney']
};
