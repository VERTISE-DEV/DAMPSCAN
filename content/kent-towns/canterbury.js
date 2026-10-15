/* Canterbury. Town page and district page in one; Whitstable and Herne Bay
   are its sibling towns. Stock notes carried over from the old district page. */
export default {
  slug: 'canterbury',
  name: 'Canterbury',
  district: 'canterbury',
  material: 'timber frame, flint and brick',
  postcodes: ['CT1', 'CT2', 'CT3', 'CT4'],
  places: ['Canterbury', 'Wincheap', 'St Dunstans', 'Hales Place', 'Thanington', 'Sturry', 'Chartham', 'Bridge', 'Harbledown'],
  nearby: ['whitstable', 'herne-bay', 'faversham', 'ashford'],
  survey: {
    intro:
      'Canterbury has more pre eighteenth century building in daily domestic use than almost anywhere else in Kent, and a great deal of it is timber framed, inside and just outside the city walls. Timber framed buildings do not fail the way brick ones do, and the single most damaging thing done to them in the last sixty years has been sealing them up with modern materials. Beyond the walls, Victorian streets, student houses and twentieth century suburbs bring the more familiar kinds of damp.',
    stock: [
      'A timber framed building works by letting moisture move through it and evaporate. The frame is filled with lath and lime plaster or brick nogging, finished in lime, and it stays sound because it dries. Cement render on the outside, gypsum plaster on the inside, or a modern impermeable masonry paint all stop that drying. Moisture then sits against the frame, and what starts as a damp patch ends as beetle infestation or wet rot in a structural member.',
      'The Victorian and Edwardian streets outside the walls, in Wincheap, St Dunstans, Northgate and around the stations, are conventional solid brick, and they present the familiar problems: bridged damp proof courses, defective rainwater goods, blocked underfloor ventilation. Many are let to students, and condensation in houses with more occupants than they were built for is a recurring cause of mould.',
      'Listed status covers a great many buildings here, and it shapes the report as much as the diagnosis does. There is no point recommending external work that will not get consent, or a treatment that is inappropriate to historic fabric. Where the answer requires opening up, it needs to be the smallest opening that will settle the question, specified precisely, so consent can be sought for that and nothing more.'
    ],
    ground:
      'The city sits in the valley of the Great Stour, which divides into branches as it runs through the centre, on river gravels and alluvium with chalk rising on either side. The riverside streets and the meadows towards Sturry are low and wet, with a high water table. The city walls themselves are largely flint and stone, and flint walling is common in older buildings across the district, with the same need for lime and breathability.',
    causes: [
      'Cement render or gypsum plaster trapping moisture against a timber frame, with decay following',
      'Beetle infestation and wet rot in structural timbers where damp has been present for years',
      'Modern impermeable paint over historic lime render',
      'Bridged courses and defective rainwater goods on Victorian streets outside the walls',
      'Condensation and mould in shared student houses with poor extraction'
    ],
    areas: [
      { name: 'Within the walls', text: 'Timber framed and historic buildings, many listed, often shops or offices with flats above. Non invasive surveys and conservation minded recommendations are the norm.' },
      { name: 'Wincheap, St Dunstans and Northgate', text: 'Victorian terraces, many let. Ground levels, gutters, airbricks and condensation in multi occupied houses are the usual causes.' },
      { name: 'Hales Place, Thanington and Sturry', text: 'Twentieth century housing and older village cores. Mould, extraction and bridged courses dominate on the estates; groundwater near the Stour.' }
    ],
    buyers:
      'Canterbury buyers range from families buying period houses to investors buying student lets. On a historic house, an independent survey sets out what is active and what is historic before a treatment firm prices the lot. On a let, it separates building defects from condensation driven by occupancy, which matters under landlord duties and for tenancy disputes.',
    more: {
      h: 'Student houses and landlord obligations',
      paras: [
        'Canterbury has a large student population, and a great many Victorian terraces outside the walls are let as shared houses. A terraced house built for a family, now with five or six adults, each showering daily and drying clothes indoors, produces far more moisture than it was built for. Bathrooms with small or failed fans, and bedrooms with replaced windows and closed trickle vents, grow mould every winter.',
        'For landlords, that is a hazard to be dealt with under housing standards and licensing conditions, and the practical answer is extraction sized for the occupancy, heating that keeps the walls warm, and dealing with any defect that makes a wall cold or wet. Our report separates the building element from the occupancy element, which helps landlords act and helps tenants and landlords agree what is reasonable.'
      ]
    },
    faq: [
      { q: 'What is the risk of using ordinary plaster in a timber framed house?', a: 'It is the most common avoidable cause of structural timber decay we see in this part of Kent. Gypsum plaster and cement render are far less permeable than the lime they replace, so moisture that used to pass through the wall and evaporate is held against the frame. Timber that stays damp for long periods is at risk of fungal decay and beetle.' },
      { q: 'Our building is listed. How much can you actually inspect?', a: 'More than people expect without opening anything up. Moisture readings, a full external inspection, roof and flashing condition, internal environment monitoring and inspection of exposed timbers settle most questions. Where they do not, we specify the minimum opening required.' },
      { q: 'Our student let has mould every winter. Is it the tenants?', a: 'Rarely only the tenants. More occupants than a house was built for, poor extraction and cold walls combine. We measure humidity, surface temperatures and extract flow so the report can show what is a building issue and what can be managed.' },
      { q: 'Do you cover Whitstable, Herne Bay and the villages?', a: 'Yes, and Sturry, Chartham, Bridge, Wingham, Blean and the rest of the district. Whitstable and Herne Bay have their own pages.' },
      { q: 'We are near the Stour. Is the damp from the river?', a: 'It may be groundwater, especially in floors. The survey separates groundwater from rainwater and building defects.' },
      { q: 'How soon can you come?', a: 'Same day reply and usually a visit within a few days.' }
    ]
  },
  proofing: {
    intro:
      'Canterbury has a great many buildings that were built centuries before damp proof courses existed, and they are frequently quoted for damp proofing they do not need and would be harmed by. We are independent surveyors and we sell no treatment, so we can tell you plainly what an old building actually needs.',
    oversold:
      'The quotes that concern us most in Canterbury are injection and cement replastering on timber framed and flint buildings, and whole house timber treatment on the strength of old flight holes. On the Victorian streets, injection along front walls bridged by raised pavements or gardens is common, and it leaves the cause in place.',
    walls:
      'Timber frames need lime and breathable finishes. Flint and old brick need lime pointing and plaster. Victorian terraces need their courses kept clear and their gutters and airbricks working. Student houses need extraction that copes with the number of people in them. Very few of these need a new damp proof course.',
    right: [
      'Removing cement and gypsum from timber frames and flint walls and replacing with lime',
      'Targeted timber repair and treatment only where decay or activity is confirmed',
      'Clearing ground, gutters and airbricks on Victorian houses',
      'Extraction sized for occupancy in shared houses'
    ],
    more: {
      h: 'Flint, frames and cement: Canterbury\'s common mistakes',
      paras: [
        'Two kinds of old wall dominate the historic city: timber frames and flint. Both were built with lime and both were designed to get a little wet and dry again. The damp problems we see in them almost always trace back to a twentieth century repair that stopped that drying: cement render on a frame, cement pointing on flint, gypsum plaster inside, or an impermeable paint over the lot.',
        'Damp proofing firms often propose injection and a waterproof plaster in response, which seals the wall further. The better approach is to reverse the harmful repair, carefully and with consent where needed, and to deal with rainwater and ground levels. It is usually less expensive, it suits the building, and it lasts.',
        'On the Victorian streets beyond the walls, damp proofing is quoted for front walls bridged by raised pavements and gardens, and for mould in shared houses. The first needs the ground dealt with; the second, ventilation and heating.'
      ]
    },
    faq: [
      { q: 'Should a timber framed building be damp proofed?', a: 'Not in the usual sense. A frame has no mortar course to inject. Keeping it dry means breathable finishes, sound rainwater goods and ground kept low around the plinth.' },
      { q: 'Do flint walls need a damp proof course?', a: 'Flint walls were built without one and rely on lime mortar and breathability. If one is damp, the usual causes are cement pointing, raised ground or rainwater.' },
      { q: 'Does a student landlord need damp proofing to meet their duties?', a: 'Landlords need to deal with damp and mould hazards. That means finding and fixing the cause, which in shared houses is often ventilation and heating rather than damp proofing.' },
      { q: 'Will damp proofing affect a listed building consent?', a: 'Injection and replastering in modern materials often need consent and may be refused. Starting from a survey avoids applying for work that is inappropriate.' },
      { q: 'Can you read our damp proofing quote?', a: 'Yes. Send it with your booking.' },
      { q: 'Do you do any of the work?', a: 'No. We survey and report only.' }
    ]
  }
};
