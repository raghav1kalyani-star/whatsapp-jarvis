# Jarvis — WhatsApp AI Personal Assistant + Voice Calls

Your own AI assistant living on WhatsApp. Remembers things, sets reminders, manages tasks, **messages people on your behalf**, and **makes phone calls for you**.

**Cost: ~₹75-150/month** (mostly Claude API + occasional call charges)

---

## What It Does

| Say this on WhatsApp | What happens |
|---|---|
| "Remember that my CA firm is LSD & Co" | Stores in permanent memory |
| "Remind me to file GST tomorrow at 5pm" | WhatsApp reminder at 5pm IST |
| "Add task: Review audit report" | Adds to task list |
| "Add contact Lokesh 919876543210" | Saves contact |
| "Tell Lokesh the audit report is ready" | Sends WhatsApp message to Lokesh |
| "Call Lokesh and tell him the meeting is at 3pm" | Calls Lokesh, speaks your message |
| "Call Ravi and ask if he can attend tomorrow" | Interactive call — Ravi can press 1=Yes, 2=No |
| "What do you know about me?" | Lists all stored memories |
| Any question | Claude-powered intelligent response |

---

## Architecture

```
You (WhatsApp) → Meta Cloud API → Your Server (Railway) → Claude API
                                       ↓                      
                                  Supabase DB ←─── Twilio Voice API
                              (memories, contacts,     (phone calls)
                               reminders, tasks,
                               call logs)
```

---

## Setup (45 minutes, one-time)

### Step 1: Supabase — Database (Free)

1. Go to [supabase.com](https://supabase.com) → Sign up → New Project
2. Copy **Project URL** and **anon key** from Settings → API
3. Go to SQL Editor → New Query → Paste `supabase-setup.sql` → Run
4. Done.

### Step 2: Meta WhatsApp Cloud API (Free)

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create App → "Business" type → Create
3. Add **WhatsApp** product
4. In WhatsApp → Getting Started, copy:
   - **Phone number ID**
   - **Access token** (temporary — make permanent below)
5. Note the test phone number (your bot's number)

**Permanent token:**
1. Business Settings → System Users → Add (Admin role)
2. Add your app with full control
3. Generate token with `whatsapp_business_messaging` permission

### Step 3: Twilio — Voice Calls (~₹1-2/min for India)

1. Go to [twilio.com](https://www.twilio.com) → Sign up (free trial includes $15 credit)
2. From Console dashboard, copy:
   - **Account SID**
   - **Auth Token**
3. Buy a phone number (₹75/month) — this is the number that calls will come FROM
   - Go to Phone Numbers → Buy a Number
   - Pick any number (doesn't matter where — calls work globally)
4. For India calling, you may need to verify your account and enable international calls

**Free trial note:** Twilio's free trial gives you $15.50 credit (~100+ calls). The trial only lets you call verified numbers — add your contacts' numbers in Twilio Console → Verified Caller IDs. Once you upgrade ($0, just add a payment method), this restriction is removed.

**Voice options:** The bot uses Amazon Polly voices via Twilio (free, included). Available Indian voices:
- `Polly.Aditi` — Female, Indian English/Hindi
- `Polly.Raveena` — Female, Indian English

### Step 4: Claude API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create API key
3. Add $5 credit (lasts months at ~$0.003/message)

### Step 5: Deploy to Railway (Free)

1. Push to GitHub:
   ```bash
   cd whatsapp-jarvis
   git init && git add . && git commit -m "Jarvis v1"
   git remote add origin https://github.com/YOU/whatsapp-jarvis.git
   git push -u origin main
   ```

2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub

3. Add environment variables (Settings → Variables):
   ```
   WHATSAPP_TOKEN=your_permanent_token
   WHATSAPP_PHONE_ID=your_phone_number_id
   WHATSAPP_VERIFY_TOKEN=jarvis_verify_2024
   ANTHROPIC_API_KEY=sk-ant-xxxxx
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_KEY=eyJxxxxx
   OWNER_PHONE=919876543210
   TWILIO_ACCOUNT_SID=ACxxxxx
   TWILIO_AUTH_TOKEN=xxxxx
   TWILIO_PHONE_NUMBER=+1234567890
   SERVER_URL=https://your-app.up.railway.app
   PORT=3000
   ```

4. **Important:** After Railway deploys and gives you a URL, go back and update `SERVER_URL` to that URL (Twilio needs it for call webhooks).

### Step 6: Connect WhatsApp Webhook

1. Meta Developer Console → WhatsApp → Configuration
2. Callback URL: `https://your-railway-url.up.railway.app/webhook`
3. Verify token: `jarvis_verify_2024` (matches your env var)
4. Click Verify and Save
5. Subscribe to: `messages`

### Step 7: Test Everything

**Test chat:**
> "Hey Jarvis, remember that my name is Raghav"

**Test contact + message:**
> "Add contact Lokesh 919876543210"
> "Tell Lokesh I'll be 10 minutes late"

**Test voice call:**
> "Call Lokesh and tell him the meeting is postponed to 4pm"

**Test interactive call:**
> "Call Lokesh and ask if he can make it to the 3pm meeting tomorrow"
→ Lokesh gets a call, presses 1 (Yes) or 2 (No)
→ You get a WhatsApp notification: "✅ Lokesh confirmed your call."

---

## Cost Breakdown

| Service | Free Tier | Ongoing Cost |
|---|---|---|
| WhatsApp Cloud API | 1,000 convos/month | ₹0 |
| Railway | $5/month credit | ₹0 |
| Supabase | 500MB, 50K rows | ₹0 |
| Claude API | Pay-per-use | ~₹75/month (300 msgs) |
| Twilio Phone Number | — | ~₹75/month |
| Twilio Voice Calls | $15.50 trial credit | ~₹1-2/min |
| **Total** | | **~₹150/month + calls** |

---

## Voice Call Types

### Simple Call (one-way announcement)
> "Call Ravi and tell him the document has been emailed"

Jarvis calls Ravi, speaks: *"Hi Ravi, this is a call on behalf of Raghav. The document has been emailed to you. This was an automated call from Jarvis. Goodbye."*

You get: `📞 Call to Ravi completed (18s).`

### Interactive Call (needs a response)
> "Call Ravi and ask if he can attend the meeting tomorrow at 3pm"

Jarvis calls Ravi, speaks: *"Hi Ravi, this is a call on behalf of Raghav. Can you attend the meeting tomorrow at 3pm? Press 1 to confirm. Press 2 to decline. Press 9 to repeat."*

You get: `✅ Ravi confirmed your call.` or `❌ Ravi declined your call.`

### Call failure handling
If Ravi doesn't pick up, you get: `📞 Call to Ravi: NO ANSWER. I'll try messaging them instead if you want.`

---

## Commands Quick Reference

**Memory:** "remember that...", "what do you remember?", "forget that..."
**Reminders:** "remind me to... at [time]", "my reminders"
**Tasks:** "add task: ...", "what's pending?", "mark task done"
**Contacts:** "add contact [Name] [Phone]", "my contacts"
**Messaging:** "tell/message/text [Name] that..."
**Calling:** "call [Name] and tell/ask..."
**General:** Any question or request

---

## File Structure

```
whatsapp-jarvis/
├── server.js              # Express + WhatsApp webhook + Voice routes
├── lib/
│   ├── claude.js          # Claude API + system prompt
│   ├── whatsapp.js        # WhatsApp Cloud API
│   ├── voice.js           # Twilio Voice — calls, TwiML, interactive
│   ├── storage.js         # Supabase data layer
│   └── scheduler.js       # Reminder cron
├── supabase-setup.sql     # DB schema (run once)
├── package.json
├── .env.example
└── README.md
```

---

## Extending Later

- **Gmail integration:** "Email Lokesh the summary" → Gmail API
- **Calendar:** "What's on my schedule?" → Google Calendar API
- **Zoho CRM:** "Update Bajaj deal to Won" → Zoho API
- **Web search:** "Latest RBI circular on NBFCs" → Tavily API
- **ElevenLabs voice:** Swap Polly for ultra-natural AI voice (~$5/month)
- **Meeting attendance:** Integrate Recall.ai to join Google Meet/Zoom, listen, and send you live summaries
