/* Dartford. Town page and district page in one; Swanscombe and Greenhithe are
   covered as neighbourhoods. Stock notes carried over from the old district
   page and extended. */
export default {
  slug: 'dartford',
  name: 'Dartford',
  district: 'dartford',
  material: 'yellow stock brick',
  postcodes: ['DA1', 'DA2', 'DA4', 'DA9', 'DA10'],
  places: ['Dartford', 'Wilmington', 'Stone', 'Greenhithe', 'Swanscombe', 'Temple Hill', 'Joydens Wood', 'Bean', 'Sutton at Hone'],
  nearby: ['swanley', 'gravesend'],
  survey: {
    intro:
      'Dartford sits on chalk where the Darent meets the Thames, and the two halves of that sentence explain most of what we find. Chalk drains fast, so damp arrives and departs with the weather. The riverside and marsh edge at Stone and Greenhithe is low, alluvial and altogether wetter. Between them is a town of Victorian terraces, interwar semis and a great deal of new building, each with its own way of getting damp.',
    stock: [
      'On the chalk, water moves through the ground quickly rather than accumulating, which gives damp a distinctly episodic character: it appears during sustained rain and eases within days. That pattern points at surface water reaching the building, at ground falls and blocked gullies, rather than at anything continuous. It is one of the most useful diagnostic signals available in this part of Kent and it is regularly overlooked in favour of a treatment.',
      'The town has a good deal of Victorian and early twentieth century terrace around the centre and up West Hill, solid walled with rear yards. Successive resurfacing of those yards has raised ground above the damp proof course on many of them. There is also a large amount of interwar and post war semi across Wilmington, Joydens Wood and Temple Hill, cavity walled with courses that generally still work, where the same bridging fault dominates.',
      'The riverside at Stone, Greenhithe and Swanscombe is former industrial and quarry land, much of it redeveloped, and Ebbsfleet and Ingress Park have added thousands of newer homes. Made ground behaves unpredictably, drainage is often relatively new but laid in variable material, and the water table near the marsh is high. Solid floors and any below ground space there need assessing on their own terms rather than by the standards of the chalk uphill.'
    ],
    ground:
      'The Darent runs north through the town to the Thames, and the land falls from the chalk of the downs to the river flats and the Dartford and Stone marshes. Chalk quarrying shaped the riverside for a century, which is why so much of the newer housing sits on reworked ground and why some gardens end at a cliff of white rock. Uphill, the chalk is overlain in places by clays and gravels that hold water for longer, so two streets a few hundred metres apart can behave quite differently after a wet week.',
    causes: [
      'Episodic damp on chalk during sustained rain, pointing at surface water rather than rising damp',
      'Raised yards and drives bridging the damp proof course on terraces and interwar semis',
      'High water table and made ground affecting solid floors near the riverside and marsh',
      'Blocked airbricks starving the void under suspended timber floors in the older streets',
      'Condensation and mould in newer riverside flats where trickle vents are kept shut and fans are undersized'
    ],
    areas: [
      { name: 'Town centre and West Hill', text: 'Victorian and Edwardian terraces, many now flats or let, with rear yards that have been concreted and re concreted. Rear wall damp in a kitchen extension is usually a yard level or a leaking waste, not rising damp.' },
      { name: 'Wilmington and Joydens Wood', text: 'Interwar and post war semis and bungalows on larger plots. Driveways and patios laid across the front and side are the classic bridging fault, along with airbricks buried behind them.' },
      { name: 'Greenhithe, Stone and Swanscombe', text: 'Older terraces near the river alongside large recent developments on former industrial land. New build questions here are about ventilation, construction moisture and drainage settling in made ground.' }
    ],
    buyers:
      'Buying in Dartford often means choosing between an older terrace near the station and a newer home by the river. They fail differently. On the terrace, a homebuyer report flagging damp usually means ground level or rainwater, and the fix is modest if it is diagnosed properly. On the new build, damp in the first year or two is often construction moisture or ventilation, and some of it may still be the developer\'s responsibility under warranty. Either way, an independent survey before exchange tells you which.',
    faq: [
      { q: 'The damp appears after heavy rain then dries out. What does that mean?', a: 'It very largely rules out rising damp, which is slow and steady and does not respond to individual weather events. Damp that tracks the rainfall is arriving from outside: surface water reaching the wall, an overflowing gutter or hopper, driving rain on an exposed elevation, or water moving quickly through chalk. That is genuinely useful evidence, so it is worth noting when it happens and what the weather was doing.' },
      { q: 'Our house is on redeveloped industrial land. Does that matter?', a: 'It can. Made ground is variable in a way natural ground is not, so drainage and services laid through it settle differently, and water can find routes that would not exist in undisturbed chalk. It does not make damp inevitable, but it does mean the external investigation matters more: ground falls, drainage runs and the condition of gullies and manholes.' },
      { q: 'We have mould in a newer flat near the river. Is that our fault?', a: 'Rarely entirely. Newer flats are airtight by design and rely on mechanical extract and trickle vents to move moisture out. If a fan moves a fraction of the air it should, or extracts into a void, the flat will grow mould whatever you do. We measure it so the report can say whether it is a building matter.' },
      { q: 'Do you cover Bean, Sutton at Hone and the Darent valley villages?', a: 'Yes, along with Wilmington, Hawley, Darenth, Longfield and the rest of the borough. The fee is the same across it.' },
      { q: 'Our cellar is damp after rain. Do we need it tanked?', a: 'Not necessarily. On chalk, water arriving in a cellar with rainfall often comes from a defective drain, a gully or surface water at one corner, and fixing that is far cheaper than tanking. The survey looks at the outside drainage before anything internal is considered.' },
      { q: 'How quickly can you get to Dartford?', a: 'We reply the same day and normally visit within a few days. Dartford is a straightforward run up the M20 and M25 from our base in East Malling.' }
    ]
  },
  proofing: {
    intro:
      'Searches for damp proofing in Dartford usually start with a tide mark on a terrace wall or a mortgage valuer\'s comment, and end with a free survey from a firm that sells injection. Before you agree to that, it is worth knowing how often the cause in this town is outside the wall. We are independent surveyors and we do not sell damp proofing.',
    oversold:
      'The quote we are most often asked to check in Dartford is chemical injection along the front and rear walls of a Victorian or interwar house, with a metre of hacking off and replastering. In a large share of those houses the existing course is intact and has been bridged by a raised yard or driveway, or the damp follows the rain and comes from a gutter or a gully. Injection leaves the bridge in place, and the new plaster simply hides the problem for a winter or two.',
    walls:
      'Most older Dartford houses are yellow stock brick in lime mortar, with a slate or bitumen course a couple of courses above the original ground. They cope well with damp so long as the ground stays below the course and the brick can dry out. The newer homes by the river are cavity built with modern membranes, where damp is almost always about ventilation, construction moisture or a detail such as a door threshold or balcony outlet.',
    right: [
      'Lowering yards, drives and patios so the existing damp proof course is clear again, or adding a gravel drain alongside',
      'Clearing and repairing gullies and downpipes, which on chalk shows up quickly as drier walls',
      'Removing salt contaminated plaster only where it is, and replacing it with a breathable finish',
      'Fixing extract ventilation in flats rather than applying anything to the walls'
    ],
    faq: [
      { q: 'Our valuer said "damp proofing works may be required". What should we do?', a: 'Treat it as a prompt to find out, not a diagnosis. A valuer takes a few meter readings and flags them. An independent survey establishes whether there is a damp problem at all, what is causing it, and what fixing it would involve, which is what a lender or a negotiation actually needs.' },
      { q: 'Is injection worth doing on a 1930s semi in Wilmington?', a: 'Usually not, because most houses of that era have a working course. Where they are damp at low level, it is almost always because a drive or patio has been laid above the course, or an airbrick has been buried. Fixing that is cheaper and it lasts.' },
      { q: 'Can damp proofing stop water in a basement near the Thames?', a: 'Not in the sense of an injected course. A below ground room near the river is holding back groundwater and needs a system designed for that, usually after drainage has been checked. The survey works out what the water is doing first, so whatever is specified is sized for it.' },
      { q: 'We had injection ten years ago and the damp is back. Is the guarantee worth claiming?', a: 'Possibly, but first establish why it is back. If the cause was always something else, such as a raised patio, the guarantee firm may argue the treatment has not failed. An independent report showing the actual cause helps either way.' },
      { q: 'Do you recommend damp proofing firms in Dartford?', a: 'No. We take no commission and refer no work. The report gives a specification you can send to any contractor, so their quotes are for the same job and easy to compare.' },
      { q: 'How long should a wall take to dry after the cause is fixed?', a: 'Months rather than weeks for a solid brick wall, often through a summer. That is why we suggest fixing external faults first and re checking before any replastering, rather than doing everything at once and sealing wet brick behind new plaster.' }
    ]
  }
};
