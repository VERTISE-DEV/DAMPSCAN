/**
 * A phone or email written into a job's notes. Jobs booked before the job
 * kept its own phone and email (and some booked through the assistant) have
 * them only in the note, so the cards read them from there when the proper
 * fields are empty.
 */
const PHONE = /(?:\+44\s?7\d{3}|\(?07\d{3}\)?|\+44\s?\(?0?\d{2,4}\)?|0\d{2,4})[\s-]?\d{3}[\s-]?\d{3,4}/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function contactFromNote(note) {
  const s = String(note || '');
  const p = s.match(PHONE);
  const e = s.match(EMAIL);
  return { phone: p ? p[0].trim() : null, email: e ? e[0] : null };
}

/** The phone and email to show: the proper fields first, else the note's. */
export function contactOf(phone, email, note) {
  if (phone && email) return { phone, email };
  const n = contactFromNote(note);
  return { phone: phone || n.phone, email: email || n.email };
}
