# Running the business from ChatGPT

Once the staff area is connected to ChatGPT (or Claude), you can just talk to it. It sees what you see in the staff area and nothing more: your businesses, and money only where you manage the business. Before it changes anything it reads back what it is about to do and waits for you to say yes. Nothing is ever sent to a customer by itself: messages come back as WhatsApp, text and email links for you to tap.

Use job numbers when you have them ("job 42"). If you only have a name or postcode, it will search first and ask which one you mean.

## What needs doing

- "What needs doing today?"
- "Which messages are due today?"
- "What's on the calendar next week?"
- "Any new enquiries since Monday?"
- "Find Mrs Patel." / "Who's at BR6 0AA?"

## Clients

- "Find the client at BR6 0AA." / "Have we done work for anyone called Patel?"
- "Add a new client for CoolRight: Dev Shah, TN13 1AA, 07700 900456."
- "Mrs Patel's new number is 07700 900999." / "Fix the spelling of the name on job 42 to Anita Patel."
- "Start a new job for Mrs Patel, same details as last time." (it reuses the client, no retyping)

## Jobs

- "Start a roofing job for Anita Patel, BR6 0AA, 07700 900123, leaking valley."
- "Book job 42 in for Tuesday the 3rd at half eight."
- "Move job 42 to completed." / "Mark job 51 as declined, they went elsewhere."
- "Add a note to job 42: side gate code is 1234."
- "Add a £240 skip to job 42."
- "Clock me in on job 42." / "Clock me out."
- "I did six hours on job 42 yesterday."
- "I drove 23 miles for job 42 today."

## Quotes

- "What's in the Verge price book?"
- "Quote job 42: 40 square metres of Redland 49, two days labour, scaffold front and back at £900."
- "Add a line to job 42: lead flashing, materials, £85."
- "Take the scaffold line off job 42."
- "Use the ridge repoint template on job 42."
- "Give me the quote link for job 42."

## Messages to customers

- "I'm on my way to job 42, about 20 minutes." (you get the words and a WhatsApp link to tap)
- "Ask job 42 for a rating."
- "Send the follow-up for job 37."
- "Remind job 42 they're booked tomorrow."
- "Send the invoice message for job 42."
- "Do the yearly check message for job 18."
- "I've sent it on WhatsApp." (it ticks the message off so Due stops asking)

## Invoices and money

- "Invoice job 42." / "Invoice job 42, 30 days to pay."
- "What's the invoice link for job 42?"
- "Deposit of £2,000 paid on job 42." / "Job 42 is paid in full."
- "Report sent on job 12." (ATi and DampScan)
- "Which bank payments aren't matched yet?"
- "Match that £500 from PATEL A to job 42."

## Photos and the website

- "Write up job 42 for the website: new roof in Orpington." (it drafts, you approve, it saves)
- "Publish job 42's page." (it tells you what is missing if it can't go up yet)
- "Give me the Google post for job 42."
- "Which area pages should we write next?"

## How are we doing

- "How are we doing this month?"
- "What's our win rate?"
- "Any low ratings?" / "What did people say about us?"
- "Which jobs are over budget?"

## The fun ones

- "Be honest, how's Verge doing compared with last month?"
- "Who's our happiest customer this year?"
- "Plan my Tuesday: what's booked, who needs a message, and what's owed."
- "Write job 42's page as if it were a nature documentary." (it will still keep the customer's name and street out of it)
- "I'm stuck in traffic outside Sevenoaks, tell job 42 I'll be 45 minutes, and make it sound cheerful."
- "Turn this voice note into a quote: forty metres of Redland, two days, scaffold both sides, skip."

## Phone notifications

In the staff app on your phone, tap **Turn on notifications** at the top. You'll get a buzz for new enquiries, quotes accepted online and new ratings (low ones flagged), only for your own businesses. Tap it again to turn them off on that phone.

To set it up once, run `npm run vapid-keys` and paste the three lines it prints (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` with your own email) into Vercel's environment variables, then redeploy. Without them the button stays hidden and nothing is sent.
