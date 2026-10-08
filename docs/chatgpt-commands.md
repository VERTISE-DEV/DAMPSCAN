# Running the business from ChatGPT

Once the staff area is connected to ChatGPT (or Claude), you can just talk to it. It sees what you see in the staff area and nothing more: your businesses, and money only where you manage the business. Before it changes anything it reads back what it is about to do and waits for you to say yes. Nothing is ever sent to a customer by itself: messages come back as WhatsApp, text and email links for you to tap.

Just say the customer's name, postcode or both ("Mrs Patel", "BR6 0AA", "Patel BR6"). You never need a job number. If two customers match, it describes them and asks which one you mean.

## What needs doing

- "What needs doing today?"
- "Which messages are due today?"
- "What's on the calendar next week?"
- "Any new enquiries since Monday?"
- "Find Mrs Patel." / "Who's at BR6 0AA?"

## Clients

- "Find the client at BR6 0AA." / "Have we done work for anyone called Patel?"
- "Add a new client for CoolRight: Dev Shah, TN13 1AA, 07700 900456."
- "Mrs Patel's new number is 07700 900999." / "Fix the spelling of the name on Mrs Patel's job to Anita Patel."
- "Start a new job for Mrs Patel, same details as last time." (it reuses the client, no retyping)

## Jobs

- "Start a roofing job for Anita Patel, BR6 0AA, 07700 900123, leaking valley."
- "Book Mrs Patel in for Tuesday the 3rd at half eight."
- "Move Mrs Patel to Thursday at 10." / "Push the Smiths in TN13 back a week." (the date moves, nothing else changes)
- "Mark Mrs Patel as completed." / "Mark the Jones job in DA1 as declined, they went elsewhere."
- "Add a note to Mrs Patel: side gate code is 1234."
- "Add a £240 skip to Mrs Patel."
- "Clock me in on Mrs Patel." / "Clock me out."
- "I did six hours on Mrs Patel yesterday."
- "I drove 23 miles for Mrs Patel today."

## Quotes

- "What's in the Verge price book?"
- "Quote Mrs Patel: 40 square metres of Redland 49, two days labour, scaffold front and back at £900."
- "Add a line to Mrs Patel: lead flashing, materials, £85."
- "Take the scaffold line off Mrs Patel."
- "Use the ridge repoint template on Mrs Patel."
- "Give me the quote link for Mrs Patel."

## Messages to customers

- "I'm on my way to Mrs Patel, about 20 minutes." (you get the words and a WhatsApp link to tap)
- "Ask Mrs Patel for a rating."
- "Send the follow-up for Dev Shah."
- "Remind Mrs Patel they're booked tomorrow."
- "Send the invoice message for Mrs Patel."
- "Do the yearly check message for the Smiths in TN13."
- "I've sent it on WhatsApp." (it ticks the message off so Due stops asking)

## Invoices and money

- "Invoice Mrs Patel." / "Invoice Mrs Patel, 30 days to pay."
- "What's the invoice link for Mrs Patel?"
- "Deposit of £2,000 paid on Mrs Patel." / "Mrs Patel is paid in full."
- "Report sent on Mr Khan's survey." (ATi and DampScan)
- "Which bank payments aren't matched yet?"
- "Match that £500 from PATEL A to Mrs Patel."

## Photos and the website

- "Write up Mrs Patel for the website: new roof in Orpington." (it drafts, you approve, it saves)
- "Publish Mrs Patel's page." (it tells you what is missing if it can't go up yet)
- "Give me the Google post for Mrs Patel."
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
- "Write Mrs Patel's page as if it were a nature documentary." (it will still keep the customer's name and street out of it)
- "I'm stuck in traffic outside Sevenoaks, tell Mrs Patel I'll be 45 minutes, and make it sound cheerful."
- "Turn this voice note into a quote: forty metres of Redland, two days, scaffold both sides, skip."

## To-do list

A to-do list shared between staff. Ask the assistant to put something on somebody's list and it keeps your words exactly as you said them. It is also in the staff app under **To-do** (for each business, and across all of them from the top bar), with Mine, Set by me, Failed and Done, and a box to tick when it's done.

- Tom: "Need to tell Scott about a potential job next week, name Laura." (a to-do for Scott, in Tom's words, set by Tom; Scott's phone buzzes)
- Scott: "Anything on the to-do list?" (it lists Tom's note, who set it and when; it also checks at the start of every chat)
- "Remind me to order the lead for Mrs Patel by Friday." / "Put on everyone's list: van MOT on the 20th."
- "What have I asked other people to do?" / "What did we finish this week?"
- "I've rung Laura." (it ticks that one off) / "Put the Laura one back on the list."

If the assistant tries to change something and it doesn't go through (a booking, a quote line, a payment), it saves what you asked and the error to your own list under **Failed**, and tells you, so you can sort it out later.

The morning digest also says how many to-dos are open for each person and how many are overdue.

## Phone notifications

In the staff app on your phone, tap **Turn on notifications** at the top. You'll get a buzz for new enquiries, quotes accepted online and new ratings (low ones flagged), only for your own businesses. Tap it again to turn them off on that phone.

To set it up once, run `npm run vapid-keys` and paste the three lines it prints (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` with your own email) into Vercel's environment variables, then redeploy. Without them the button stays hidden and nothing is sent.
