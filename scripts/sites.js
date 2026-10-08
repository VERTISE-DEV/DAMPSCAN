/**
 * Every brand the generators build pages for: name, domain, contact details,
 * nav, footer and the paths its pages live at. Split out of area-template.js,
 * which still re-exports it, so that file is the template and this is the
 * configuration. Adding a brand is an entry here.
 */
import { formSubmitUrl, leadEmailFor } from '../lib/lead-email.js';
import { BRANDS } from '../lib/brands.js';

export const SITES = {
  dampscan: {
    key: 'dampscan',
    brand: 'DampScan',
    origin: 'https://dampscan.co.uk',
    logo: null,
    phone: '+447386225526',
    phoneLabel: '07386 225526',
    email: 'tom@atidampsurvey.co.uk',
    schemaType: 'LocalBusiness',
    served: 'Kent and the South East of England',
    strap: 'Damp, mould and timber surveys across Kent and the South East',
    surveyMateSlug: 'dampscan',
    /* The mobile action bar. Kept as the literal it always was. */
    barLabel: 'Book a survey',
    areasPath: '/damp-survey',
    sitemapFile: 'sitemap.xml',
    ctaLabel: 'Book a Survey',
    headBg: 'rgba(8,19,33,.86)',
    headSolid: '#081321',
    /* The wordmark, matching the home page exactly. */
    lockup: '<span class="logo"><span class="logo-type"><span class="logo-word">Damp<span class="scan">Scan</span></span><span class="logo-tag">Survey Specialists</span></span></span>',
    nav: [
      { label: 'How It Works', href: '/#how' },
      { label: 'Services', href: '/services' },
      { label: 'Prices', href: '/pricing' },
      { label: 'Guides', href: '/guides' },
      { label: 'What you get', href: '/#reviews' },
      { label: 'Landlords', href: '/#landlords' },
      { label: 'Areas', href: '/damp-survey' },
      { label: 'FAQs', href: 'FAQ' }
    ],
    // The Business Profile share link: credits Google where the reviews came
    // from, and goes into sameAs so search can tie the site to the profile.
    footerLinks: [
      { href: '/services', label: 'Services' },
      { href: '/damp-survey', label: 'Areas' },
      { href: '/guides', label: 'Guides' },
      { href: '/pricing', label: 'Prices' }
    ],
    profileUrl: 'https://share.google/kC2SRRJEFz5DqKXC9',
    og: '/assets/dampscan-og.png',
    book: {
      sessionKey: 'dampscan-session',
      attrKey: 'dampscan-attr',
      notify: formSubmitUrl('dampscan'),
      subjectPrefix: leadEmailFor('dampscan').subjectPrefix,
      dataLayerEvent: 'dampscan'
    }
  },
  ati: {
    key: 'ati',
    brand: 'ATi Damp Survey',
    origin: 'https://atidampsurvey.co.uk',
    logo: '/assets/ati-mark.png',
    phone: '+442033554944',
    phoneLabel: '020 3355 4944',
    email: 'team@atidampsurvey.co.uk',
    schemaType: 'ProfessionalService',
    served: 'London',
    strap: 'Independent damp and timber surveys, no remedial work',
    surveyMateSlug: 'ati-damp-survey',
    /* The mobile action bar. Kept as the literal it always was. */
    barLabel: 'Book a survey',
    areasPath: '/damp-survey',
    sitemapFile: 'sitemap-london.xml',
    ctaLabel: 'Request a Survey',
    headBg: 'rgba(245,245,243,.9)',
    headSolid: '#f5f5f3',
    lockup: '<span class="logo"><img src="/assets/ati-mark.png" alt="" /><span class="logo-tag">Independent Damp Surveys &amp; Reports</span></span>',
    nav: [
      { label: 'How It Works', href: '/#how' },
      { label: 'Services', href: '/services' },
      { label: 'Prices', href: '/pricing' },
      { label: 'Guides', href: '/guides' },
      { label: 'The report', href: '/#reviews' },
      { label: 'Landlords', href: '/#landlords' },
      { label: 'London Coverage', href: '/damp-survey' },
      { label: 'FAQs', href: 'FAQ' }
    ],
    footerLinks: [
      { href: '/services', label: 'Services' },
      { href: '/damp-survey', label: 'Areas' },
      { href: '/guides', label: 'Guides' },
      { href: '/pricing', label: 'Prices' }
    ],
    profileUrl: 'https://share.google/UR3GLPt8y1SyLr5FV',
    og: '/assets/ati-og.png',
    book: {
      sessionKey: 'ati-damp-session',
      attrKey: 'ati-damp-attr',
      notify: formSubmitUrl('ati'),
      subjectPrefix: leadEmailFor('ati').subjectPrefix,
      dataLayerEvent: 'ati-damp'
    }
  },
  /* Verge Roofing. A different business from the two damp brands, sharing this
     repo for the generators and nothing else: its own domain, its own Business
     Profile, its own Ads account, and no link to or from either damp site.

     phone and phoneLabel are set together: the templates leave every call
     link out while either is null rather than shipping tel:null on thirty
     pages, which is how the pages were built before the number was issued. */
  roofing: {
    key: 'roofing',
    brand: BRANDS.roofing.name,
    origin: BRANDS.roofing.origin,
    logo: '/assets/verge-logo.png',
    phone: BRANDS.roofing.phone,
    phoneLabel: BRANDS.roofing.phoneLabel,
    email: BRANDS.roofing.email,
    schemaType: 'RoofingContractor',
    served: 'London, Kent, Surrey, Essex, Hertfordshire, Sussex and Berkshire',
    areasServed: ['Greater London', 'Kent', 'Surrey', 'Essex', 'Hertfordshire', 'East Sussex', 'West Sussex', 'Berkshire'],
    strap: 'Roofing across London and the South East',
    surveyMateSlug: null,
    /* The regional pages, at the URLs the old vergeroofing.com used, so the
       links and rankings they had carry over. */
    areasPath: '/roofing-in',
    sitemapFile: 'sitemap-roofing.xml',
    ctaLabel: 'Get a Quote',
    barLabel: 'Get a quote',
    /* The closing block on the services and guides pages. The damp sites
       keep the survey wording those templates were written with. */
    enquiryCta: {
      heading: 'Get a free quote',
      body: 'Tell us what the roof needs. We reply the same day, come out and price it for free, and put a fixed price in writing.'
    },
    headBg: 'rgba(20,20,20,.9)',
    headSolid: '#141414',
    lockup: '<span class="logo"><img src="/assets/verge-logo.png" alt="Verge Roofing" width="155" height="48" /><span class="logo-tag">Higher standards</span></span>',
    /* No Prices entry, because every roof is quoted and the guides carry the
       basis instead. A nav item is a promise that a page answers, so Reviews
       joins this list when content/reviews/roofing.js holds enough to show:
       until then the section is hidden and the link would go nowhere. */
    nav: [
      { label: 'How It Works', href: '/#how' },
      { label: 'Services', href: '/services' },
      { label: 'Our work', href: '/our-work' },
      { label: 'Areas', href: '/roofing-in' },
      { label: 'Guides', href: '/guides' },
      { label: 'FAQs', href: 'FAQ' }
    ],
    /* No Prices: every roof is quoted. A footer that lists pages a brand does
       not have is a dead link on every page of it. */
    footerLinks: [
      { href: '/services', label: 'Services' },
      { href: '/our-work', label: 'Our work' },
      { href: '/roofing-in', label: 'Areas' },
      { href: '/guides', label: 'Guides' }
    ],
    /* Photographs of finished jobs, published from the staff area and served
       by api/gallery.js; see content/gallery.js for the words around them. */
    galleryPath: '/our-work',
    font: '/assets/fonts/archivo-latin.woff2',
    /* A UK mobile as 447..., once one is given for WhatsApp; until then no
       button is shown. */
    whatsapp: null,
    /* Real reviews on every service page, once content/reviews/roofing.js
       holds enough for the home page to show them. */
    reviewsOnServices: true,
    profileUrl: 'https://share.google/p2JjORGy8UdZUpQnV',
    /* Other places the business is, linked in the footer and listed in sameAs
       so search engines can tie them to this site. */
    socials: [{ label: 'Instagram', href: 'https://www.instagram.com/vergeroofing/' }],
    og: null,
    book: {
      sessionKey: 'verge-session',
      attrKey: 'verge-attr',
      notify: formSubmitUrl('roofing'),
      subjectPrefix: leadEmailFor('roofing').subjectPrefix,
      subjectComplete: leadEmailFor('roofing').subjectComplete,
      subjectPartial: leadEmailFor('roofing').subjectPartial,
      dataLayerEvent: 'verge-roofing'
    }
  },
  /* CoolRight. Air conditioning, heating and ventilation, and the fourth brand
     in this project. Like roofing it quotes every job, so it has no pricing
     page, and its number is not issued yet so no call link ships. */
  ac: {
    key: 'ac',
    brand: BRANDS.ac.name,
    origin: BRANDS.ac.origin,
    logo: null,
    phone: BRANDS.ac.phone,
    phoneLabel: BRANDS.ac.phoneLabel,
    email: BRANDS.ac.email,
    schemaType: 'HVACBusiness',
    served: 'London and the whole of the South East',
    strap: 'Air conditioning, heating and ventilation across London and the South East',
    surveyMateSlug: null,
    areasPath: null,
    font: '/assets/fonts/manrope.woff2',
    whatsapp: null,
    reviewsOnServices: true,
    sitemapFile: 'sitemap-ac.xml',
    ctaLabel: 'Get a Quote',
    barLabel: 'Get a quote',
    enquiryCta: {
      heading: 'Get a free quote',
      body: 'Tell us what you are trying to solve. We reply the same day, the quote visit costs nothing, and the price comes back fixed and in writing.'
    },
    headBg: 'rgba(15,23,42,.88)',
    headSolid: '#0f172a',
    lockup: '<span class="logo"><span class="logo-type"><span class="logo-word">Cool<span class="scan">Right</span></span><span class="logo-tag">Climate control. Done right.</span></span></span>',
    nav: [
      { label: 'How It Works', href: '/#how' },
      { label: 'Services', href: '/services' },
      { label: 'Guides', href: '/guides' },
      { label: 'FAQs', href: 'FAQ' }
    ],
    footerLinks: [
      { href: '/services', label: 'Services' },
      { href: '/guides', label: 'Guides' }
    ],
    profileUrl: 'https://share.google/MFCiCldTnpS3VMcVW',
    og: null,
    book: {
      sessionKey: 'coolright-session',
      attrKey: 'coolright-attr',
      notify: formSubmitUrl('ac'),
      subjectPrefix: leadEmailFor('ac').subjectPrefix,
      subjectComplete: leadEmailFor('ac').subjectComplete,
      subjectPartial: leadEmailFor('ac').subjectPartial,
      dataLayerEvent: 'coolright'
    }
  }
};
