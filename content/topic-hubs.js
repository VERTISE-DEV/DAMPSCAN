/**
 * The words on the "Common problems" and "Seasonal" hub pages, merged into
 * content/hubs.js. Kept apart only so that file stays readable. A brand with
 * no entry for a kind gets no hub for it, and no pages under it.
 */
export const topicHubs = {
  roofing: {
    problems: {
      title: 'Common Roof Problems | Leaks, Slipped Tiles, Chimneys | Verge Roofing',
      metaDescription:
        'The roof problems we are called out to most: leaks, slipped and missing tiles, flat roofs, chimneys and moss. The signs, the causes, what we do and how it is priced.',
      h1: 'Common roof problems, and what they mean',
      intro:
        'Most people do not call a roofer about a service. They call because there is a stain on the ceiling, a tile on the lawn or water coming in round the chimney. These pages start from what you can see.',
      body: [
        'Each one explains the signs, the usual causes and what we do about it, with honest wording on price. Where a page on our services or guides already answers a question in full, such as storm damage, gutters or whether to repair or replace, we link to it rather than writing it twice.'
      ]
    },
    seasonal: {
      title: 'Seasonal Roofing Advice | Winter Checks and Storm Damage | Verge Roofing',
      metaDescription:
        'What to do about your roof as the seasons change: winter checks before the storms, storm damage repairs, and clearing moss and gutters in spring.',
      h1: 'Roofing through the year',
      intro:
        'Roofs fail in winter but the faults start in summer. A little attention at the right time of year saves most of the emergency calls we take.',
      body: [
        'These pages are live all year. The one that matters right now is also on our home page and in the menu.'
      ]
    }
  },
  ac: {
    problems: {
      title: 'Common Air Conditioning Problems | Not Cooling, Leaks, Noise | CoolRight',
      metaDescription:
        'Air con not cooling, leaking water, making a noise or smelling musty. What each fault usually means, what you can check first, and what an engineer does.',
      h1: 'Common air conditioning problems',
      intro:
        'Most faults show up in one of four ways: it stops cooling, it drips, it gets noisy or it smells. Each has a short list of likely causes, and some you can check yourself before calling anybody.',
      body: [
        'These pages go through each one. Servicing, heat pumps for heating and installation costs have their own service and guide pages, which we link to rather than repeat.'
      ]
    },
    seasonal: {
      title: 'Seasonal Air Conditioning Advice | Spring Servicing, Summer Installs | CoolRight',
      metaDescription:
        'When to service your air conditioning, when to book an installation, and how the same system heats the house in winter.',
      h1: 'Air conditioning through the year',
      intro:
        'The worst time to find a fault, or to book an installation, is the first hot week of the year. These pages are about getting the timing right.',
      body: [
        'They are live all year. The one in season is also on our home page and in the menu.'
      ]
    }
  },
  dampscan: {
    seasonal: {
      title: 'Seasonal Damp Advice | Autumn Condensation and Mould | DampScan',
      metaDescription:
        'Damp and mould advice for the time of year, starting with condensation and black mould as the heating goes on in autumn, across Kent and the South East.',
      h1: 'Damp and mould through the year',
      intro:
        'Condensation is a seasonal problem, and most of our autumn and winter calls are about it. What you can do yourself, and when a survey is worth it, changes with the weather.',
      body: [
        'These pages are live all year. The one in season is also on our home page and in the menu.'
      ]
    }
  },
  ati: {
    seasonal: {
      title: 'Seasonal Damp Advice for London | Autumn Condensation | ATi Damp Survey',
      metaDescription:
        'Condensation and mould in London homes as the heating goes on: how to tell it from damp, what to record, and when an independent survey helps.',
      h1: 'Damp and mould in London, through the year',
      intro:
        'London flats are some of the most condensation prone homes in the country, and the problem arrives with the autumn. Independent advice, with no treatment to sell.',
      body: [
        'These pages are live all year. The one in season is also on our home page and in the menu.'
      ]
    }
  }
};
