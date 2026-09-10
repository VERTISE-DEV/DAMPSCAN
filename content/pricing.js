/**
 * Published survey prices, per site.
 *
 * Both practices publish, and they publish for opposite reasons, which is why
 * this is two sets of words rather than one set with the brand swapped.
 *
 * ATi carries out no remedial work, so the survey is the entire transaction and
 * the fee is simply the price of the thing being sold.
 *
 * DampScan does carry out the work, which makes publishing harder rather than
 * easier: a firm that surveys and then quotes has an obvious reason to find
 * something. Its page has to say that out loud and explain what stops it, or it
 * is worth less than saying nothing. What stops it is that the survey is paid
 * for on its own, so the diagnosis is not funded by whatever follows it.
 *
 * Both pages state that the figure shown is the figure paid, without going into
 * why. If either practice's tax position ever changes so that something does
 * get added to these prices, that line has to change on the same day, because a
 * price that quietly stops being the total is the sort of thing these pages
 * exist to argue against.
 */

const ati = {
  site: 'ati',
  slug: 'pricing',
  title: 'Damp Survey Prices in London | ATi Damp Survey',
  metaDescription:
    'What an independent damp survey costs in London. Four fixed price bands from £215, what each includes, and what is never added afterwards.',
  h1: 'What a survey costs, and what decides it',
  intro:
    'Most damp surveys in London are free, and that is the problem with them. A free survey is paid for by the work it recommends, which is why so many of them recommend work. We sell no remedial work at all, so the survey is the whole transaction and the price can simply be published.',

  /* Two separate claims, and neither is allowed to overreach. The old wording
     said nothing is ever added and then listed an add on, which is the kind of
     thing this practice exists to stop other people doing. */
  priceLead: 'The price you see is the price you pay.',
  fixedFee: 'The survey fee is agreed in writing before we attend and does not change afterwards, whatever we find. There is one optional extra, an invasive inspection, and it is never carried out unless you agree to it on the day.',

  bands: [
    {
      key: 'localised',
      name: 'Localised damp survey',
      price: '£215',
      fixed: true,
      scope: 'One or two rooms',
      best: 'A specific problem in a specific place: one damp wall, one stained ceiling, one room with mould.',
      note: 'The rest of the property is not inspected, so if the cause turns out to sit elsewhere we will say so and tell you what a wider look would cost. We do not simply widen the survey and bill you for it.'
    },
    {
      key: 'full',
      name: 'Full house survey',
      price: '£295',
      fixed: true,
      scope: 'Up to three bedrooms',
      best: 'Most flats and terraces. A whole property inspected inside and out, whether or not you have spotted a problem in every room.',
      note: 'This is the right choice before a purchase, for a landlord facing a complaint, or when damp has appeared in more than one place and you do not yet know whether they are related.'
    },
    {
      key: 'large',
      name: 'Large property survey',
      price: 'From £375',
      fixed: false,
      scope: 'Four to five bedrooms',
      best: 'Larger houses, which take longer to inspect properly rather than being harder.',
      note: 'The figure moves with the size of the building and how much of it is accessible. We confirm the exact fee in writing before we attend, and it does not move afterwards.'
    },
    {
      key: 'premium',
      name: 'Very large or period property',
      price: 'From £450',
      fixed: false,
      scope: 'Six or more bedrooms, heavily extended, or listed and period',
      best: 'Buildings where the construction itself is the complication: multiple build eras, cellars, lightwells, extensions meeting original fabric.',
      note: 'Quoted individually after we know what the building is. Ask and we will give you a figure, not a range, before you commit to anything.'
    }
  ],

  /* Printed inside every band card, identical in each, because it applies to
     every band and a reader comparing two cards should not have to notice that
     only one of them mentions it. */
  invasiveLine: 'Invasive checks, if needed: £85. If we find something on site that can only be settled by opening up, we carry the tools for it: small incisions in plaster, a length of skirting off, a floorboard lifted. Agreed with you before we start, never after.',

  included: [
    'A qualified surveyor on site for as long as the property takes, not a fixed appointment slot',
    'Calibrated moisture readings taken to depth, not surface readings from a pin meter',
    'Surface temperature and humidity readings where condensation has to be excluded rather than assumed',
    'External inspection: ground levels, drainage, gutters, pointing, roof junctions and anything else feeding water into the building',
    'A written report within 24 hours of the visit, with photographs and the readings behind every conclusion',
    'A clear statement of what does not need doing, and where a quote you are holding goes beyond the defect',
    'A specification detailed enough for you to obtain competitive quotes, which we will never bid for'
  ],

  notIncluded: [
    {
      h: 'Nothing is added for travel',
      p: 'Anywhere in Greater London, the agreed fee is the fee. Congestion Charge, ULEZ and parking are our problem, not a line on your invoice. Outside the M25 we quote individually or refer you on.'
    },
    {
      h: 'Evenings and weekends cost no more',
      p: 'We work around tenants and working days as a matter of course. There is no out of hours premium.'
    },
    {
      h: 'A second visit, if you need one',
      p: 'If you need us back after works to verify what was done, that is a shorter visit and priced accordingly. It is never assumed or added automatically.'
    }
  ],

  faq: [
    {
      q: 'Why would I pay when other firms survey for free?',
      a: 'Because a free survey is not free, it is a sales visit, and the cost of it sits inside the work that gets recommended afterwards. That arrangement is fine when the diagnosis is obvious and the work is genuinely needed. It stops being fine the moment the honest answer is that little or nothing needs doing, because nobody in that arrangement gets paid for saying so. We carry out no remedial work of any kind, so there is no version of the conclusion that earns us more. The fee is what pays for the opinion.'
    },
    {
      q: 'I have damp in one room of a four bedroom house. Which band?',
      a: 'Start with the localised survey at £215. If the cause is where the damp is, that is the whole job and you have paid the smallest fee that answers the question. If the readings point somewhere else in the building, we will tell you on site what a full survey would cost and you can decide there and then. We would rather sell you the £215 twice than the £375 once for no reason.'
    },
    {
      q: 'What if you find nothing wrong?',
      a: 'The fee is the same, and the report is arguably worth more. Establishing that a property does not have a damp problem is a real finding, and it is the one that saves people the most money, whether that is a purchase that proceeds or a quote that gets refused. You are paying for the inspection and the written conclusion, not for a list of defects.'
    },
    {
      q: 'Can the price change after you arrive?',
      a: 'The survey fee cannot, including if the property turns out to be larger or more awkward than described. The only way your total ends up higher than the band price is if you agree on the day to an invasive inspection, which starts at £85 for the visit. We will only suggest it where opening up would actually change the conclusion, and if it would not we will tell you that instead.'
    }
  ]
};

const dampscan = {
  site: 'dampscan',
  slug: 'pricing',
  title: 'Damp Survey Prices in Kent and the South East | DampScan',
  metaDescription:
    'What a damp survey costs across Kent and the South East. Four fixed price bands from £215, what each includes, and why the survey is paid for on its own.',
  h1: 'What a survey costs, and what decides it',

  /* The hard sentence, and it goes first on purpose. DampScan does the works,
     so a reader is right to wonder whether the survey exists to sell them.
     Saying so before they think it is the only way the rest of the page is
     worth reading. */
  intro:
    'We carry out the remedial work as well as the survey, so you are entitled to ask whether the survey exists to sell you the work. It does not, and the price is how we keep that true: the survey is paid for on its own, which means the diagnosis does not have to earn its keep from whatever comes after it.',

  priceLead: 'The price you see is the price you pay.',
  fixedFee: 'The survey fee is agreed in writing before we attend and does not change afterwards, whatever we find. There is one optional extra, an invasive inspection, and it is never carried out unless you agree to it on the day.',

  bands: [
    {
      key: 'localised',
      name: 'Localised damp survey',
      price: '£215',
      fixed: true,
      scope: 'One or two rooms',
      best: 'A specific problem in a specific place: one damp wall, one stained ceiling, one room with mould.',
      note: 'The rest of the property is not inspected, so if the cause turns out to sit elsewhere we will say so and tell you what a wider look would cost. We do not simply widen the survey and bill you for it.'
    },
    {
      key: 'full',
      name: 'Full house survey',
      price: '£295',
      fixed: true,
      scope: 'Up to three bedrooms',
      best: 'Most semis and terraces. A whole property inspected inside and out, whether or not you have spotted a problem in every room.',
      note: 'This is the right choice before a purchase, for a landlord facing a complaint, or when damp has appeared in more than one place and you do not yet know whether they are related.'
    },
    {
      key: 'large',
      name: 'Large property survey',
      price: 'From £375',
      fixed: false,
      scope: 'Four to five bedrooms',
      best: 'Larger houses, which take longer to inspect properly rather than being harder.',
      note: 'The figure moves with the size of the building and how much of it is accessible. We confirm the exact fee in writing before we attend, and it does not move afterwards.'
    },
    {
      key: 'premium',
      name: 'Very large or period property',
      price: 'From £450',
      fixed: false,
      scope: 'Six or more bedrooms, heavily extended, or listed and period',
      best: 'Buildings where the construction itself is the complication: multiple build eras, cellars, outbuildings, extensions meeting original fabric.',
      note: 'Quoted individually after we know what the building is. Ask and we will give you a figure, not a range, before you commit to anything.'
    }
  ],

  invasiveLine: 'Invasive checks, if needed: £85. If we find something on site that can only be settled by opening up, we carry the tools for it: small incisions in plaster, a length of skirting off, a floorboard lifted. Agreed with you before we start, never after.',

  included: [
    'A qualified surveyor on site for as long as the property takes, not a fixed appointment slot',
    'Calibrated moisture readings taken to depth, not surface readings from a pin meter',
    'Surface temperature and humidity readings where condensation has to be excluded rather than assumed',
    'External inspection: ground levels, drainage, gutters, pointing, roof junctions and anything else feeding water into the building',
    'A written report within 24 hours of the visit, with photographs and the readings behind every conclusion',
    'A clear statement of what does not need doing, and where a quote you are holding goes beyond the defect',
    'A specification detailed enough to take to other contractors, whether or not you ask us to price the work'
  ],

  notIncluded: [
    {
      h: 'Nothing is added for travel',
      p: 'Anywhere across our Kent and South East coverage, the agreed fee is the fee. Fuel, tolls and parking are our problem, not a line on your invoice. Properties inside London are surveyed by our sister practice, ATi Damp Survey, and priced the same way.'
    },
    {
      h: 'Evenings and weekends cost no more',
      p: 'We work around tenants and working days as a matter of course. There is no out of hours premium.'
    },
    {
      h: 'A second visit, if you need one',
      p: 'If you need us back after works to verify what was done, that is a shorter visit and priced accordingly. It is never assumed or added automatically.'
    }
  ],

  faq: [
    {
      /* The question the whole page turns on. Anything less than a direct
         answer here reads as evasion, and evasion is what the reader already
         suspects. */
      q: 'You do the works as well. What stops the survey finding something?',
      a: 'The fee. A free survey has to be paid for by the work it recommends, which means the person diagnosing the problem only gets paid if there is one. Charging for the survey breaks that: it is already paid for by the time we write the report, so a report saying little or nothing needs doing costs us nothing to write. That is the whole reason the survey is priced separately rather than folded into a quote, and it is why the report tells you what does not need doing as plainly as what does.'
    },
    {
      q: 'Does the survey fee come off the works if I go ahead?',
      a: 'No, and that is deliberate. A fee credited against the works is a discount you lose by saying no, which is a quiet pressure to say yes. The survey is a separate piece of work with its own price, and it stays that way whether you use us for the remedial work, use somebody else, or do nothing at all. You are free to take the specification to other contractors, and plenty of people do.'
    },
    {
      q: 'I have damp in one room of a four bedroom house. Which band?',
      a: 'Start with the localised survey at £215. If the cause is where the damp is, that is the whole job and you have paid the smallest fee that answers the question. If the readings point somewhere else in the building, we will tell you on site what a full survey would cost and you can decide there and then. We would rather sell you the £215 twice than the £375 once for no reason.'
    },
    {
      q: 'What if you find nothing wrong?',
      a: 'The fee is the same, and the report is arguably worth more. Establishing that a property does not have a damp problem is a real finding, and it is the one that saves people the most money, whether that is a purchase that proceeds or a quote that gets refused. You are paying for the inspection and the written conclusion, not for a list of defects.'
    },
    {
      q: 'Can the price change after you arrive?',
      a: 'The survey fee cannot, including if the property turns out to be larger or more awkward than described. The only way your total ends up higher than the band price is if you agree on the day to an invasive inspection, which starts at £85 for the visit. We will only suggest it where opening up would actually change the conclusion, and if it would not we will tell you that instead.'
    }
  ]
};

export const pricing = { ati, dampscan };
