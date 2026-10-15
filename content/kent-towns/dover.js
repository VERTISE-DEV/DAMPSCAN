/* Dover. Town page and district page in one; Deal is its sibling town.
   Stock notes carried over from the old district page and extended. */
export default {
  slug: 'dover',
  name: 'Dover',
  district: 'dover',
  material: 'flint, chalk block and brick',
  postcodes: ['CT15', 'CT16', 'CT17'],
  places: ['Dover', 'River', 'Temple Ewell', 'Whitfield', 'Maxton', 'Tower Hamlets', 'Buckland', 'St Margarets at Cliffe', 'Capel le Ferne'],
  nearby: ['deal', 'folkestone'],
  survey: {
    intro:
      'Dover is chalk, cliff and coast, with a town built into the valley of the River Dour between two areas of high ground, the castle on one side and the Western Heights on the other. Exposure is severe on the seaward side, the chalk drains fast and unpredictably, and the older housing includes a good deal of flint and chalk block that behaves quite differently from brick.',
    stock: [
      'Flint and chalk block walls, common in the older stock here and in the surrounding villages, are rubble constructions bound in lime. Chalk block in particular is soft and highly absorbent, and it depends entirely on being kept dry by a permeable render and on being able to release what it does take in. Cement render on a chalk block wall is one of the more destructive things that can be done to a building in this area, and it is not rare.',
      'The seafront and exposed elevations take severe wind driven rain, and the salt that comes with it accumulates in masonry and keeps meter readings high after the wall has dried. The Victorian terraces of Tower Hamlets, Maxton and Buckland, climbing the valley sides, are solid brick with rear yards cut into the slope.',
      'The town sits in a valley cut into chalk, so surface and near surface water moves quickly downhill toward buildings during heavy rain, and the properties cut into the valley sides retain ground on their uphill elevation. Damp on an uphill wall here is lateral water and it is dealt with outside, by interception and drainage, rather than by anything applied to the internal face.'
    ],
    ground:
      'The Dour rises at Temple Ewell and River and runs through the valley floor to the harbour, partly culverted in town. The valley floor has river deposits and a higher water table; the slopes are chalk. Whitfield, on the plateau above, has much newer housing on well drained ground. The famous cliffs east and west of the harbour are a visible reminder of what everything here is built on.',
    causes: [
      'Cement render on soft, absorbent chalk block walls, preventing them from drying',
      'Flint and rubble walls repointed in cement and no longer able to release moisture',
      'Salt contamination from severe coastal exposure, giving misleading readings',
      'Lateral water against the uphill elevation of houses cut into the valley sides',
      'Surface water running downhill at buildings during heavy rain on chalk'
    ],
    areas: [
      { name: 'The seafront and town centre', text: 'Older buildings and flats exposed to the Channel. Render, salt and wind driven rain dominate, with flats raising freeholder questions.' },
      { name: 'Tower Hamlets, Maxton and Buckland', text: 'Victorian terraces on the valley sides. Lateral damp on uphill walls, yards and drainage are the usual causes.' },
      { name: 'River, Temple Ewell and Whitfield', text: 'Village cores with flint and chalk building, and newer estates on the plateau. Lime repairs in the villages; ventilation and condensation in newer homes.' }
    ],
    buyers:
      'Dover has some of the most affordable housing in Kent, much of it Victorian terraces on slopes and older flint cottages in the villages. Homebuyer reports often recommend damp specialists. An independent survey before exchange separates lateral water, cement damage and salt from genuine defects, and gives you a realistic cost.',
    more: {
      h: 'Valley streets and the Western Heights',
      paras: [
        'Dover\'s terraces climb both sides of the Dour valley, and many streets are cut into the slope so that the houses on one side have their rear walls against the hill and the houses on the other have their front walls above the pavement. The first group gets lateral damp at the back; the second gets surface water running down the street and the paths against the front. Knowing which side of the street a house is on tells us half the story before we arrive.',
        'Below the Western Heights and around the castle, older buildings in flint, chalk block and brick are common, many altered over two centuries. Cement render applied in the twentieth century to soft walls is the commonest cause of their damp, and the damage it does to chalk block in particular can be serious if left.',
        'Whitfield and the newer estates on the plateau are a different world: modern houses on well drained chalk, where damp is mostly condensation and ventilation. A survey there looks at extraction, trickle vents and cold spots rather than walls and ground.'
      ]
    },
    faq: [
      { q: 'What is chalk block and why does it matter?', a: 'Blocks cut from chalk, used as walling where it was the cheapest material, and present in older buildings around Dover. It is soft, absorbent and adequate only while it stays dry. It relies on a permeable render and on drying out. Seal it with cement and it holds water and degrades.' },
      { q: 'Damp on the uphill wall of our house. Rising or something else?', a: 'On a property cut into a chalk valley side it is almost always lateral. The ground behind the wall is holding water, which arrives quickly during rain. The remedy is outside and uphill of the wall: intercepting the water before it arrives.' },
      { q: 'Why are readings so high on our seaside wall?', a: 'Salt from spray collects in masonry and attracts moisture, so meters read high. Readings at depth and the pattern separate salt from water.' },
      { q: 'Do you cover Deal, River and Whitfield?', a: 'Yes, and Temple Ewell, St Margarets at Cliffe, Capel le Ferne and the rest of the district.' },
      { q: 'Is a damp cellar in Dover normal?', a: 'Chalk cellars often take water during heavy rain. If you want to use one as a room, it needs a designed below ground solution.' },
      { q: 'How soon can you visit?', a: 'Same day reply and usually within a few days.' }
    ]
  },
  proofing: {
    intro:
      '"Damp experts Dover" and "damp proofing Dover" are common searches, and most of the walls behind them are chalk block, flint or Victorian brick on slopes. We are independent surveyors and we sell no treatment, so we can tell you plainly whether damp proofing is the answer.',
    oversold:
      'The Dover quotes that concern us most are injection and cement replastering on chalk block and flint walls, and injection on uphill walls that are wet from the slope behind. On chalk block, cement replastering accelerates decay. On retaining walls, injection does nothing for water arriving sideways.',
    walls:
      'Chalk block and flint need lime render, lime pointing and breathable finishes. Victorian terraces on slopes need drainage on the uphill side and below ground solutions where rooms sit below ground. Seafront walls need sound render and salt tolerant plaster.',
    right: [
      'Removing cement render from chalk block and replacing with lime',
      'Lime repointing on flint walls',
      'Intercepting surface water uphill of houses on the valley sides',
      'Salt tolerant plaster on exposed seafront walls'
    ],
    more: {
      h: 'Why chalk and flint walls are often harmed by damp proofing',
      paras: [
        'Chalk block is weak when wet and strong when dry. Flint walls rely on lime mortar to stay sound. Both depend on being able to lose water as fast as they take it in. Most damp proofing systems do the opposite: they add a barrier and a dense, waterproof plaster that stop the wall drying on the inside face.',
        'On a chalk block wall that has already been rendered in cement outside, adding a waterproof plaster inside traps the wall between two impermeable skins. Moisture builds up, salts crystallise and the block softens. We have seen walls where the face of the chalk had turned to paste behind the plaster. The repair after that is far more expensive than the treatment was.',
        'The proportionate approach is lime render and lime plaster, ground kept low, rain kept out, and the wall allowed to dry. Where a wall is below ground on the uphill side, drainage and a drained membrane are the answer. The survey establishes which applies before any money is spent.'
      ]
    },
    faq: [
      { q: 'Can chalk block walls be damp proofed?', a: 'They can be kept dry, but not with the usual damp proofing. Chalk block needs lime render outside, lime plaster inside and ground kept low. Injection and waterproof plaster trap moisture in a soft material that weakens when wet, and we have seen walls badly damaged by it.' },
      { q: 'Does a wall cut into the valley side need a damp proof course?', a: 'No. It is retaining ground and is wet from the side. It needs water intercepted uphill of the house and, if a room sits below ground, a below ground system. A horizontal course does nothing for lateral water.' },
      { q: 'Is salt damp on our seafront wall a reason for damp proofing?', a: 'No. Salt from spray draws moisture out of the air into the plaster. Replacing contaminated plaster with a salt tolerant finish and keeping rain out of the wall helps; an injected course does not.' },
      { q: 'What should a Dover damp proofing quote include?', a: 'The cause in writing, which walls and how high, the plaster specification and why it suits the wall, any outside work to be done first, the drying time before decoration, and exactly what the guarantee covers. If those are missing, ask before you sign.' },
      { q: 'Our Whitfield new build has mould. Is damp proofing needed?', a: 'Almost certainly not. Mould in a modern house is condensation, ventilation or a construction detail. The survey measures extraction and humidity, and the report can go to the developer if it is a defect.' },
      { q: 'Do you carry out work?', a: 'No. We survey and report only, which is why the report can tell you when damp proofing is not needed.' }
    ]
  }
};
