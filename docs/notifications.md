# Phone alerts

Every alert goes to the ntfy topic in `NTFY_TOPIC`. New enquiries, accepted
quotes and ratings also go to the installed staff app (Web Push) for whoever
holds that business. Alerts are written to be understood from a lock screen
at a glance.

## The rules

- The job is named the way staff talk about it: the customer's first name and
  postcode district, "Sarah, BR6". No job numbers. Never a surname, phone,
  email, street or full postcode in the visible text. With only a title and
  surname on file ("Mrs Patel") it says "a customer in BR6".
- Money is short: £5,630, or £5,630.50 when there are pence.
- Dates read "Sat 18 Oct", times "9:30am".
- Title leads with what happened, then the brand: "Booked: Verge Roofing".
- One alert per action. A failed push never fails the change that caused it.
- Tapping opens the right staff page (`STAFF_URL`, default
  `https://dampscan.co.uk/staff`, with `?area=` so the right company opens).
- Priority: high (4) for a customer waiting on us, default (3) for the rest,
  low (2) for routine staff activity.
- To-do words are never sent: a to-do alert only says who it is for and from.

Words are built in `lib/alert-words.js`.

## Every alert

| When | Tag | Priority | Title | Body | Tap opens |
| --- | --- | --- | --- | --- | --- |
| New enquiry finished on a website (`api/lead.js`, `lib/alert-enquiry.js`) | 📞 telephone_receiver | 4 | New enquiry: Verge Roofing | Sarah in BR6 needs help with leak or water coming in. Tap Call to ring them back. | Leads page. Buttons: **Call** (tel: link) and **Open** |
| Quote accepted online (`api/quote.js`) | 🤝 handshake | 4 | Quote accepted: Verge Roofing | Sarah, BR6 accepted the £5,630 quote online. Call to book a start date. | Job |
| Job saved as booked (`lib/notify-quoted.js`) | 📅 calendar | 3 | Booked: Verge Roofing | Sarah, BR6 is booked for Sat 18 Oct at 9:30am, £5,630. | Job |
| Job saved as a quote | 📋 clipboard | 3 | Quoted: Verge Roofing | Sarah, BR6 has been quoted £5,630. | Job |
| Job moved to done (or declined, cancelled) | ✅ white_check_mark | 3 | Job done: Verge Roofing | Sarah, BR6 is now done, £5,630. | Job |
| Payment recorded | 💰 moneybag | 3 | Payment in: Verge Roofing | £1,689 from Sarah, BR6 (Verge). £3,941 left to pay. | Job |
| Payment that clears the bill | 🎉 tada | 3 | Paid in full: Verge Roofing | Sarah, BR6 has paid in full, £5,630. Last payment £3,941. | Job |
| Payout locked | 🔒 lock | 3 | Payout locked: Verge Roofing | Sarah, BR6: £810 to pay out to 2 people. | Job |
| Payout reopened | 🔓 unlock | 3 | Payout reopened: Verge Roofing | Sarah, BR6 is open for changes again. Open the job to see why. | Job |
| Rating, 4 or 5 stars (`lib/rating.js`) | ⭐ star | 3 | New rating: Verge Roofing | Sarah, BR6 gave 5 stars and left a comment. | Job |
| Low rating | ⚠️ warning | 4 | Low rating: Verge Roofing | Sarah, BR6 gave 2 stars. Worth a call. | Job |
| Staff change (`lib/activity.js`) | 🧾 receipt for costs, ✏️ pencil otherwise | 2 | Tom made a change: Verge Roofing | Tom added a £260 cost to Sarah, BR6. | Job, or the Due page |
| Change made through ChatGPT | as above | 2 | Tom made a change: Verge Roofing | Tom (via ChatGPT) added a £1,000 quote line to Sarah, BR6. | Job |
| To-do set (`lib/todos.js`) | 📝 memo | 3 | To-do for Scott from Tom | Open the to-do list to read it. | To-do list |
| To-do ticked off or reopened | 📝 memo | 2 | To-do done: Scott | Scott ticked off a to-do set by Tom. | To-do list |
| A ChatGPT change that failed | 📝 memo | 3 | Change failed: Tom via ChatGPT | A change Tom asked ChatGPT for did not go through. It is on their to-do list. | To-do list |
| Morning digest, per business (`lib/digest.js`) | 🌅 sunrise | 3 | Good morning: Verge Roofing | 1 job tomorrow. 1 quote out over a week with no answer. £500 outstanding on 1 completed job. | Due page |
| Morning digest, general to-dos | 🌅📝 | 3 | Good morning: to-do list | 3 open to-dos (Scott 2, Tom 1), 1 overdue. | To-do list |

The staff app's own buzz for a to-do set for you: "New to-do from Tom" /
"Open the to-do list to read it."

## Privacy note on the Call button

The enquiry's Call button needs the phone number in its `tel:` link. It is
never shown as text, but it is sent to the ntfy server inside the action, and
anyone subscribed to the topic can read it. On ntfy.sh a topic is public to
anyone who knows its name, so use a long, unguessable topic name, or a
protected topic with `NTFY_TOKEN`.
