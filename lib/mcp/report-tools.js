/**
 * The finished survey report as a file. The surveyor uploads the PDF in the
 * chat and says whose it is; attach_report keeps it on that job. For the
 * final email, get_report_file gives a link that works for a week, which the
 * person's own Outlook connector can attach to a draft. Nothing is emailed
 * from here (the owners chose drafts in Outlook, checked and sent by them).
 *
 * The report holds the customer's details, so a work-level surveyor reaches
 * only the reports of the jobs they survey or were handed, the same rule as
 * the phone and email.
 */
import { query } from '../db.js';
import { record } from '../audit.js';
import { fetchReport, reportLink } from '../report-file.js';
import { ownJobs } from '../figures.js';
import { staffBase } from '../alert-words.js';
import { read, write, fail, notFound, jobInScope, canManage, ID } from './shared.js';

const isDamp = (site) => site === 'dampscan' || site === 'ati-london';
const ok = (data) => ({ status: 200, data: { ok: true, ...data } });

async function reachable(scope, id) {
  const found = await jobInScope(scope, id);
  if (!found) return { error: notFound() };
  if (!isDamp(found.job.site)) return { error: fail('Reports are for ATi and DampScan surveys.') };
  if (!canManage(scope, found.job.site) && !(await ownJobs(scope)).has(Number(found.job.id))) return { error: fail('That report is for a survey somebody else is doing.') };
  return found;
}

async function attach(scope, { id, report }) {
  const found = await reachable(scope, id);
  if (found.error) return found.error;
  const file = report && typeof report === 'object' ? report : {};
  const got = await fetchReport(file.download_url, file.name || file.file_name);
  if (got.error) return fail(got.error);
  const j = found.job;
  await query('update jobs set report_path = $2, report_name = $3, report_at = now(), updated_at = now() where id = $1', [j.id, got.path, got.name]);
  await record({ scope, business: j.site, entity: 'job', entityId: j.id, action: 'report_file', before: { name: j.report_name || null }, after: { name: got.name } });
  return ok({ said: `Report ${got.name} saved on ${j.customer_name || 'the job'}'s card.`, name: got.name });
}

async function getFile(scope, { id }) {
  const found = await reachable(scope, id);
  if (found.error) return found.error;
  const j = found.job;
  if (!j.report_path) return fail('No report file on that job yet. Upload the PDF in the chat and ask to attach it.');
  const origin = staffBase().replace(/\/staff$/, '');
  return ok({ name: j.report_name, uploadedAt: j.report_at, customerEmail: j.customer_email || null, link: reportLink(origin, Number(j.id)),
    said: `The report is ${j.report_name}. The link works for 7 days.` });
}

const attachTool = write('attach_report', 'Attach the survey report',
  'Saves the finished survey report (a PDF or Word file the person uploaded in this chat) on the client\'s card. Pass the uploaded file as report.',
  { id: ID, report: { type: 'object', description: 'The uploaded file.', properties: { download_url: { type: 'string' }, file_id: { type: 'string' }, name: { type: 'string' } }, required: ['download_url'] } },
  ['id', 'report'], attach, { idempotent: true });
/* Tells ChatGPT which argument is a file from the conversation. */
attachTool._meta = { 'openai/fileParams': ['report'] };

export const REPORT_TOOLS = [
  attachTool,
  read('get_report_file', 'Get the survey report file', 'The saved survey report on a client\'s card: its name, the customer\'s email and a download link that works for 7 days. For the final email, draft it in the person\'s own Outlook (their connector) with this file attached, for them to check and send, then mark_report_sent once they have.',
    { id: ID }, getFile)
];
