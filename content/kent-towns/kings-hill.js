/* Kings Hill. A new settlement built from the 1990s on the former RAF West
   Malling airfield; almost every survey here is a modern house or flat. */
export default {
  slug: 'kings-hill',
  name: 'Kings Hill',
  district: 'tonbridge-and-malling',
  material: 'modern brick and block',
  postcodes: ['ME19'],
  places: ['Kings Hill', 'West Malling', 'Mereworth', 'Wateringbury', 'Offham', 'East Malling', 'Teston', 'Barming', 'Leybourne'],
  nearby: ['west-malling', 'east-malling', 'tonbridge', 'maidstone'],
  survey: {
    intro:
      'Kings Hill was built on the former RAF West Malling airfield, starting in the 1990s and growing in phases ever since, so nearly every home here is less than thirty five years old. That makes damp in Kings Hill a different subject from damp in the ragstone villages around it. Rising damp is almost unheard of. Condensation, ventilation, construction moisture and the small details where water gets into modern buildings are what we survey for.',
    stock: [
      'The earlier phases are mostly brick and block cavity houses with concrete or beam and block ground floors, uPVC windows and, typically, intermittent extract fans in kitchens and bathrooms. Insulation standards were good for their time. Mould here usually forms where the insulation is thinnest or interrupted: around windows, at the junction of walls and ceilings below a loft, and in corners behind wardrobes on outside walls.',
      'Later phases and the apartment buildings near the centre are built to tighter standards, with more airtight construction and, in many cases, continuous mechanical extract or whole house ventilation with heat recovery. These systems work well when they are commissioned and maintained. When filters clog, a unit is switched off because it is noisy, or a duct in the loft has come apart, moisture builds up quickly in an airtight home.',
      'Many Kings Hill houses are timber framed behind a brick outer leaf, which most owners do not realise. Timber frame is sound construction, but it is less forgiving of water getting in at window and door openings, at roof abutments and at balconies, and it is important that a survey knows what is behind the plaster before drawing conclusions from a meter reading.'
    ],
    ground:
      'The development sits on high, fairly level ground on the Hythe Beds and sands south of West Malling, which generally drains well. Surface water is managed through engineered drainage and balancing ponds rather than natural streams, so where a house has damp at ground level, the questions are about its own drainage details, gully connections and the levels of paths and patios laid after handover rather than about groundwater.',
    causes: [
      'Mould around windows, in bedroom corners and behind furniture from condensation in airtight homes',
      'Mechanical ventilation not commissioned, switched off, or with ducts disconnected in the loft',
      'Water entering at window and door openings, balcony outlets and roof abutments',
      'Patios and paths laid by owners above the damp proof course after handover',
      'Construction moisture in the first winters of newer phases, read as a leak'
    ],
    areas: [
      { name: 'The earlier phases', text: 'Houses from the 1990s and 2000s, now past their original warranty. Extract fans, window seals and patio levels are the most common sources of trouble.' },
      { name: 'Apartments near the centre', text: 'Flats with mechanical ventilation, often in buildings managed by an agent. Responsibility for ventilation systems and external details may sit with the management company.' },
      { name: 'Newer phases and the edge of the development', text: 'More recent homes, some still in warranty. Construction moisture, commissioning and snagging defects are the usual questions.' }
    ],
    buyers:
      'Buying in Kings Hill usually means buying a house that is between a few years and thirty years old. A homebuyer report mentioning mould or damp readings is common and rarely means anything like rising damp. What matters is whether the ventilation works, whether any water is getting in at openings or abutments, and, on newer houses, what remains of the warranty. An independent survey before exchange answers those questions.',
    faq: [
      { q: 'Our Kings Hill house is less than ten years old and has mould. Is that normal?', a: 'Some condensation in the first winter or two can be normal while construction moisture dries out. Persistent mould after that, or mould near a ventilation terminal, usually points to a ventilation problem or a detail defect. We measure both so the report can say which.' },
      { q: 'Our flat has a ventilation unit that is noisy. Can we turn it off?', a: 'It is designed to run continuously, and turning it off in an airtight flat almost always leads to condensation and mould. Noise often means a clogged filter or a fault that can be fixed. The report will say what the system is doing and what it should be doing.' },
      { q: 'Is our house timber framed?', a: 'Many Kings Hill houses are timber frame behind a brick outer skin. The survey checks the construction before interpreting any readings, because damp in a timber frame wall needs a different response.' },
      { q: 'We laid a patio and now the wall is damp. Is that connected?', a: 'Very likely if the patio is less than about two brick courses below the damp proof course. It is a common post handover fault and the fix is at the patio, not in the wall.' },
      { q: 'Can your report help with a warranty claim?', a: 'Yes. It records the measured ventilation performance, readings, photographs and the cause, which is what a developer or warranty provider will ask for.' },
      { q: 'How soon can you visit?', a: 'Kings Hill is a few minutes from our base in East Malling, so visits can often be arranged within a day or two.' }
    ]
  },
  proofing: {
    intro:
      'Kings Hill houses are modern, built with damp proof courses and membranes that almost always still work. So if a firm has quoted for damp proofing on a Kings Hill home, that is a reason to get an independent opinion. We are based next door in East Malling and we sell no treatment.',
    oversold:
      'The Kings Hill quotes we are asked to check are usually for injecting walls or installing a "condensation control" package after mould has appeared. In a house under thirty years old, a failed damp proof course is very rare. Mould comes from condensation, ventilation that is not working, or water getting in at an opening. Injecting the wall does nothing for any of those.',
    walls:
      'A Kings Hill wall is a cavity wall, often with a timber frame inner leaf, built with a damp proof course and cavity trays. It needs its course kept clear of patios, its openings sealed, its trays doing their job and, above all, the house ventilated as designed. That is maintenance and repair, not damp proofing.',
    right: [
      'Commissioning, repairing or cleaning mechanical ventilation and extract fans',
      'Resealing window and door openings and checking cavity trays at abutments',
      'Lowering patios and paths laid above the damp proof course after handover',
      'Clearing balcony outlets and checking thresholds on flats'
    ],
    more: {
      h: 'Five things to check before anyone treats a Kings Hill wall',
      paras: [
        'Is the extract fan in the bathroom and kitchen running, ducted to outside, and moving air you can feel at the grille? Are trickle vents open? Has a patio, path or flower bed been built up near the damp proof course? Is there a gap in the sealant around the window or door near the damp? Is the damp near a balcony, a roof junction or a gutter outlet above?',
        'If the answer to any of those is yes, that is where to start. A survey confirms which and measures what cannot be seen, such as the flow at a fan or the temperature of a cold corner.'
      ]
    },
    faq: [
      { q: 'Can a modern house get rising damp?', a: 'Only if the damp proof course has been bridged, for example by a patio, or damaged during later work. Genuine failure of a modern course is rare. That is why a survey should come before any treatment.' },
      { q: 'Is a positive input ventilation unit the answer to mould?', a: 'Sometimes. In some Kings Hill houses, fixing the existing extract fans does more. In flats with whole house ventilation, adding another system can conflict with it. The survey looks at what is already there first.' },
      { q: 'Who is responsible for ventilation in a Kings Hill flat?', a: 'It depends on the lease and the building. Individual units are often the flat owner\'s responsibility, while shared ducts, external terminals and the building envelope may be the management company\'s. The report identifies where the fault is so the right party can act.' },
      { q: 'Will damp proofing affect our NHBC or warranty cover?', a: 'Unnecessary work on a building still under warranty can complicate a later claim. If you are still within the warranty period, report the defect to the developer or warranty provider first, with independent evidence.' },
      { q: 'Do you recommend ventilation installers?', a: 'No. We specify what is needed and can measure the flow afterwards, so you know the job was done properly.' },
      { q: 'What does a survey cost compared with damp proofing?', a: 'Our survey fees are published and fixed before the visit. They are a small fraction of a typical damp proofing quote, and on a modern house the survey often shows that no damp proofing is needed at all.' }
    ]
  }
};
