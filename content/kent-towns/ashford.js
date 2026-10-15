/* Ashford. Town page and district page in one. Stock notes carried over from
   the old district page and extended. */
export default {
  slug: 'ashford',
  name: 'Ashford',
  district: 'ashford',
  material: 'Victorian brick and modern block',
  postcodes: ['TN23', 'TN24', 'TN25', 'TN26'],
  places: ['Ashford', 'Kennington', 'Willesborough', 'Singleton', 'Park Farm', 'Kingsnorth', 'Repton Park', 'Godinton', 'Great Chart'],
  nearby: ['canterbury', 'folkestone', 'hythe', 'maidstone'],
  survey: {
    intro:
      'Ashford is unusual in Kent for how much of its housing is new. Alongside the Victorian railway terraces around the station there are very large estates built since the 1970s, at Singleton, Park Farm, Kingsnorth, Repton Park and Godinton, and new build damp is a different subject entirely: it is about airtightness, ventilation and construction moisture rather than about anything having failed.',
    stock: [
      'A modern house is built to be airtight and insulated to a standard the older stock never approached. That is good for heating bills and unforgiving of ventilation failures. If the mechanical ventilation was never commissioned, has been turned down because it was noisy, or has ducting that was crushed or left disconnected in the roof, the moisture a household generates has nowhere to go. Mould in a two year old house is almost always a ventilation defect, and it is a defect the builder is often still responsible for.',
      'The other new build phenomenon is construction moisture. A newly built masonry house contains a great deal of water in its blockwork, screed and plaster, and it takes many months to dry out. During the first winter that shows as condensation, streaming windows and mould in cupboards and corners, and it is routinely misdiagnosed as a leak. Knowing the difference saves an owner from chasing a defect that is not there, and from accepting one that is.',
      'The older parts of the town, around the station, Newtown and the original centre, are conventional Victorian brick terraces with the usual issues: raised external ground bridging the damp proof course, defective rainwater goods, blocked airbricks. Out in Kennington, Willesborough and the villages there is weatherboarding, timber frame and the occasional oast, which need breathable repairs rather than modern impermeable ones.'
    ],
    ground:
      'Ashford sits where the Great Stour and the East Stour meet, on Weald clay and river deposits, with the greensand rising to the north. The river valleys through the town are low and wet, and areas near the rivers have flood risk. Weald clay drains slowly and moves with the seasons, so gardens hold water and new estates rely on engineered drainage and balancing ponds.',
    causes: [
      'Mould in a new build house where the mechanical ventilation was never commissioned or has been disabled',
      'Ducting crushed, disconnected or discharging into a roof void rather than to outside',
      'First winter condensation from construction moisture, misread as a leak or a defect',
      'Raised paths and drives bridging the damp proof course on the older terraces',
      'Blocked airbricks and musty suspended ground floors in Victorian houses'
    ],
    areas: [
      { name: 'Around the station and Newtown', text: 'Victorian railway terraces. Ground levels, airbricks and rear additions are the main causes.' },
      { name: 'Singleton, Park Farm, Kingsnorth and Repton Park', text: 'Large modern estates. Ventilation, construction moisture and detail defects, often within warranty.' },
      { name: 'Kennington, Willesborough and the villages', text: 'Older village cores with weatherboarding and timber frames, plus twentieth century housing. Breathable repairs and condensation.' }
    ],
    buyers:
      'Many Ashford buyers are choosing between a newer house on one of the estates and a Victorian terrace near the station. On the new house, find out whether any damp is construction moisture, a ventilation fault or a defect still under warranty. On the terrace, find out whether it is ground level, rainwater or salts. An independent survey before exchange answers both.',
    more: {
      h: 'New build warranties and what to record',
      paras: [
        'Most new homes in England come with a structural warranty for ten years, and the developer is usually responsible for putting right defects reported in the first two years. Damp and mould in a new Ashford home often fall into that window, and what settles a dispute is evidence: measured ventilation flow against the design figure, humidity and surface temperature readings, photographs of ducting in the loft, and the pattern of the mould.',
        'We record those in a form a developer\'s customer care team or a warranty provider can act on. Where the evidence points to how the house is used rather than how it was built, the report says that too, with practical steps, because there is no point pursuing a claim the facts will not support.'
      ]
    },
    faq: [
      { q: 'Our new build is damp. Is that normal, or is something wrong?', a: 'Both are common and need telling apart. Condensation through the first winter can be normal while construction moisture dries. Persistent mould, mould in later winters, or mould near a ventilation terminal is a defect. We measure ventilation performance as well as moisture, which is what a warranty provider will want.' },
      { q: 'The developer says it is condensation and therefore our responsibility. Is it?', a: 'Not necessarily. If it is happening because a ventilation system does not move the air it was specified to, because ducting is crushed or disconnected, or because the system was never commissioned, that is a construction defect. Our report records measured air flow against what the design required.' },
      { q: 'Our Victorian terrace near the station has damp at the front. Why?', a: 'Usually raised pavement or path levels bridging the course, or a bay or downpipe. The survey finds which.' },
      { q: 'Do you cover Kennington, Willesborough and the villages?', a: 'Yes, and Wye, Charing, Hamstreet, Tenterden and the rest of the borough.' },
      { q: 'Is our house at risk from the rivers?', a: 'Flood risk is for the Environment Agency maps and insurers. We can tell you how the building is coping with moisture and whether groundwater is affecting it.' },
      { q: 'How soon can you visit?', a: 'Same day reply and usually within a few days. Ashford is a straight run down the M20.' }
    ]
  },
  proofing: {
    intro:
      'Much of Ashford is new, and new houses almost never need damp proofing. If you have been quoted for it on a modern Ashford home, or on one of the older terraces, an independent survey first will tell you whether it is justified. We sell no treatment.',
    oversold:
      'The Ashford quotes we see most are damp proofing or "condensation packages" on new build houses where the problem is uncommissioned ventilation or construction moisture, and injection on Victorian terraces where raised ground has bridged the course. In the first case, the developer may be responsible. In the second, the fix is at the ground.',
    walls:
      'Modern Ashford walls are cavity built with damp proof courses and membranes that work. They need working ventilation and sound details. Victorian terraces need their courses kept clear, their airbricks open and their gutters working. Village buildings need breathable repairs.',
    right: [
      'Commissioning or repairing mechanical ventilation in new homes',
      'Raising defects with the developer or warranty provider while in warranty',
      'Lowering ground and reopening airbricks on Victorian terraces',
      'Breathable repairs on weatherboarded and timber framed village houses'
    ],
    more: {
      h: 'Older Ashford: terraces, villages and oasts',
      paras: [
        'The Victorian terraces around the station and Newtown were built for railway workers, in brick with slate courses that mostly still work. Pavements, yards and paths have risen over the years, and on many houses the ground now sits at or above the course. That is the commonest cause of low level damp in them, and lowering or draining the ground is the fix.',
        'In Kennington, Willesborough and the villages beyond, you find weatherboarded cottages, timber frames and oast conversions. These need breathable repairs and attention to sole plates and lower boards, not injection. A converted oast in particular needs its wall build up and ventilation assessed together, because the conversion closed up a building designed to let air through.',
        'Either way, the right work is usually maintenance and repair to the building rather than a damp proofing system, and the survey sets out exactly what and in what order.'
      ]
    },
    faq: [
      { q: 'Can a new build need damp proofing?', a: 'Rarely. If damp appears, it is usually ventilation, construction moisture or a detail defect. Report it to the developer with independent evidence while in warranty.' },
      { q: 'Will damp proofing affect our warranty?', a: 'Unnecessary work can complicate a claim. Get the cause established independently first.' },
      { q: 'Is injection right for an Ashford terrace?', a: 'Occasionally, but most have a working course bridged by raised ground. Fixing the ground is cheaper and lasts.' },
      { q: 'How long does construction moisture take to dry?', a: 'Typically through the first one or two heating seasons. Persistent problems after that point to a defect.' },
      { q: 'Can you check our quote?', a: 'Yes. Send it with your booking and we will comment on it.' },
      { q: 'Do you carry out work?', a: 'No. We survey and report only.' }
    ]
  }
};
