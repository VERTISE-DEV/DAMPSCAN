/* Verge Roofing's home page.

   Written as a roofing contractor's page rather than an inspector's: the
   headline says the trade, the area and the scope, the process is about the
   work rather than the visit, and every claim is one the business has
   confirmed. No guarantee terms and no accreditations are stated, by the
   owners' choice, and there is no emergency call-out service to promise. */
export default {
  site: 'roofing',
  title: 'Roofers in London & the South East | Re-roofs, Repairs, Flat Roofs | Verge Roofing',
  metaDescription:
    'Roofing contractors covering London, Kent, Surrey, Essex, Sussex, Hertfordshire and Berkshire. Re-roofs, roof repairs, flat roofs, EPDM, leadwork and conservatory roofs. Thirty years in the trade. Free quotes, fixed in writing.',
  h1: 'Re-roofs, repairs and flat roofs across London and the South East',
  lede:
    'Pitched roofs in tile and natural slate, felt and EPDM rubber flat roofs, leadwork, chimneys, box gutters and conservatory roof conversions. Carried out by our own team, with thirty years in the trade behind it. Tell us what the roof needs and we will come out, price it for free and put a fixed figure in writing.',

  trust: [
    'Thirty years in the roofing trade',
    'Every job carried out by our own team, never subcontracted',
    'Free quote visit, no call-out charge',
    'Fixed price in writing, scaffolding and skips included',
    'Fully insured'
  ],

  /* Customer reviews sit straight under the headline, in the same carousel
     as the damp home pages, and show once there are enough of them. */
  reviewsFirst: true,
  reviewsHeading: 'What our customers say',

  process: {
    h2: 'How a job runs, from your enquiry to a finished roof',
    intro:
      'Most of what matters happens on the roof, so most of this is about the work itself.',
    steps: [
      {
        h3: 'Tell us what the roof needs',
        body: 'Send the form with your postcode and a line about the job. Photos help, and sometimes mean we can give you a guide price straight away. We reply the same day.'
      },
      {
        h3: 'Free quote, fixed in writing',
        body: 'We come out, get up on the roof where it is safe to, and send a written quote within 48 hours: the work, the materials by name and one fixed price.'
      },
      {
        h3: 'The work',
        body: 'Scaffold up, old roof off where it is coming off, then the new roof on by our own team. The house is sheeted and watertight every night, and the site is cleared every day.'
      },
      {
        h3: 'Finished and cleared away',
        body: 'Gutters cleared, debris gone, scaffold down, and you walk round it with us. You get the completion photographs to keep.'
      }
    ]
  },

  servicesSection: {
    h2: 'Roofing services',
    intro:
      'From a few slipped tiles to a full strip and re-roof, a new flat roof or a tiled roof on what used to be a conservatory. Each page says what the work involves, what is included in the price and the questions people ask us about it.'
  },

  coverage: {
    h2: 'Roofers covering London and the whole of the South East',
    intro:
      'Our own teams work right across the region, so a quote visit is usually days away rather than weeks. Recent jobs include re-roofs in Orpington, Blackfen and Milton, a natural slate roof in Petts Wood, a loft conversion roof in Bexley and a lead box gutter in central London. If your town is not listed, send your postcode anyway, or see <a href="/roofing-in">every area we cover</a>.',
    /* Each card links to its region page, which is how those pages get found. */
    regions: [
      { name: 'Greater London', href: '/roofing-in', places: ['Every borough, from Bromley, Bexley and Croydon to Barnet, Ealing and Havering'] },
      { name: 'Kent', href: '/roofing-in/kent-and-south-east-london', places: ['Orpington', 'Bromley', 'Dartford', 'Sevenoaks', 'Tunbridge Wells', 'Maidstone', 'Medway', 'Gravesend', 'Canterbury'] },
      { name: 'Surrey', href: '/roofing-in/surrey-and-south-west-london', places: ['Croydon', 'Kingston', 'Sutton', 'Epsom', 'Guildford', 'Woking', 'Reigate'] },
      { name: 'Essex', href: '/roofing-in/essex-and-east', places: ['Romford', 'Brentwood', 'Basildon', 'Chelmsford', 'Southend', 'Ilford', 'Grays'] },
      { name: 'Hertfordshire', href: '/roofing-in/hertfordshire-and-north-west', places: ['Watford', 'St Albans', 'Hemel Hempstead', 'Borehamwood', 'Hatfield', 'Enfield'] },
      { name: 'Sussex and Berkshire', href: '/roofing-in/sussex-and-berkshire', places: ['Crawley', 'Horsham', 'Brighton', 'Slough', 'Windsor', 'Reading'] }
    ]
  },

  faqHeading: 'Questions people ask before choosing a roofer',
  faq: [
    {
      q: 'Is the quote free?',
      a: 'Yes. We come out, get up on the roof where it is safe to, and give you a written price. There is no call-out charge and no obligation.'
    },
    {
      q: 'Who actually does the work?',
      a: 'Our own team, every time. We do not sell the job on to a subcontractor, so the people who priced it are the people responsible for it.'
    },
    {
      q: 'Is the price fixed, and what is in it?',
      a: 'Fixed. Scaffolding, materials, labour, skips and making good are all in the figure, and the materials are named on the quote. If opening the roof shows something nobody could have seen from outside, we stop, show you, and agree any change before doing it.'
    },
    {
      q: 'How soon can you start, and how long does it take?',
      a: 'It depends on the season and the job, and we give you a start date with the quote. A repair is usually a day or two. A re-roof on a typical semi is about a week once the scaffold is up, weather allowing.'
    },
    {
      q: 'How do I pay?',
      a: 'Payment terms are agreed with you before any work starts and written on the quote, so there are no surprises about when anything is due.'
    },
    {
      q: 'Will you tell me if I do not need the work?',
      a: 'Yes. A roof with years left in it does not need replacing today, and if a repair will do, we will price the repair.'
    },
    {
      q: 'Do you work with insurers after storm damage?',
      a: 'Yes. We photograph the damage before we touch it and write a quote scoped line by line, which is what loss adjusters need to settle a claim. We do not run an out-of-hours emergency service.'
    },
    {
      q: 'What happens to my details?',
      a: 'They go to the person pricing your job and nowhere else. They are not sold, shared with lead brokers or added to any marketing list.'
    }
  ],

  ctaHeading: 'Get your free roofing quote',
  ctaBody:
    'Send your postcode and what the roof needs. We reply the same day, come out and price it for free, and put a fixed price in writing within 48 hours.'
};
