/**
 * Sections of an area page that depend on which brand it is, split out of
 * area-template.js to keep that file readable: ATi's shared survey framing
 * and DampScan's list of towns inside a district.
 */
import { BOROUGH_COPY, BOROUGH_SECTIONS } from './borough-copy.js';
import { variantCode, pick } from './variants.js';
import { townsIn } from '../content/kent-towns.js';
import { londonProofing } from '../content/london-proofing/index.js';

const esc = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* ATi's borough pages carry the sections every survey shares (what is
   inspected, the report, the process), in versions chosen per borough so the
   pages do not repeat each other. Lengthens each page with things a reader
   wants to know, rather than with padding. */
export function boroughFraming(area, allAreas) {
  if (area.site !== 'ati') return '';
  const index = allAreas.filter((a) => a.site === 'ati').indexOf(area);
  const code = variantCode(Math.max(0, index), 3, BOROUGH_SECTIONS, allAreas.filter((a) => a.site === 'ati').length);
  const covers = pick(BOROUGH_COPY.covers, code, 0)(area);
  const report = pick(BOROUGH_COPY.report, code, 1)(area);
  const process = pick(BOROUGH_COPY.process, code, 2)(area);
  const who = pick(BOROUGH_COPY.who, code, 3)(area);
  const kinds = pick(BOROUGH_COPY.kinds, code, 5)(area);
  const tenure = pick(BOROUGH_COPY.tenure, code, 6)(area);
  const proof = londonProofing.some((p) => p.slug === area.slug)
    ? ` Quoted for damp proofing already? Read <a href="/damp-proofing/${area.slug}">damp proofing in ${esc(area.name)}: survey first</a>.`
    : '';
  return `  <section class="sec">
    <h2>${esc(kinds.h)}</h2>
    ${kinds.paras.map((p) => `<p>${p}</p>`).join('\n    ')}
  </section>

  <section class="sec">
    <h2>${esc(covers.h)}</h2>
    <ul class="ticks">
      ${covers.list.map((c) => `<li>${c}</li>`).join('\n      ')}
    </ul>
  </section>

  <section class="sec">
    <h2>${esc(report.h)}</h2>
    <p>${report.lead}</p>
    <ul class="ticks">
      ${report.list.map((c) => `<li>${c}</li>`).join('\n      ')}
    </ul>
  </section>

  <section class="sec">
    <h2>${esc(process.h)}</h2>
    <ol class="steps">
      ${process.steps.map((c) => `<li>${c}</li>`).join('\n      ')}
    </ol>
    <p>${who}${proof}</p>
  </section>

  <section class="sec">
    <h2>Leaseholders, landlords and buyers in ${esc(area.name)}</h2>
    <p>${tenure}</p>
  </section>
`;
}

/* A DampScan district page is a hub for the town pages inside it. */
export function districtTowns(area) {
  if (area.site !== 'dampscan') return '';
  const list = townsIn(area.slug);
  if (!list.length) return '';
  return `  <section class="sec">
    <h2>Towns in ${esc(area.name)}</h2>
    <p>Each town has its own page on its housing, ground and the damp we find there.</p>
    <ul class="chips">
      ${list.map((t) => `<li><a href="/damp-survey/${t.slug}">Damp survey in ${esc(t.name)}</a></li><li><a href="/damp-proofing/${t.slug}">Damp proofing in ${esc(t.name)}</a></li>`).join('\n      ')}
    </ul>
  </section>
`;
}

