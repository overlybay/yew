# YEW — Twilio Phone Setup (plain-language guide)

This gets YEW's calling and texting working. There are two phases:
**Phase 1 = free testing** (call/text only numbers you verify), **Phase 2 = go live**
with real businesses. You only do Phase 1 once, then Phase 2 when you're ready
to sell.

---

## Phase 1 — Free testing (about 15 minutes)

Twilio gives every new account a free trial: **30 days, no credit card**,
with **100 free texts and 75 free voice minutes**. Limits while on trial:
you can only call/text **phone numbers you verify** in the console, and
that's it — perfect for testing YEW on your own phone.

1. Go to **twilio.com/try-twilio** and create a free account. Confirm your
   email and your own cell number when it asks.
2. You'll land in the **Twilio Console** (console.twilio.com). This is your
   dashboard — everything below happens here.
3. **Verify your test number:** in the console, go to **Phone Numbers →
   Verified Caller IDs** and add your cell number. Twilio texts you a code;
   enter it. (Trial accounts can only reach verified numbers — that's why.)
4. **Buy a phone number:** go to **Phone Numbers → Buy a number**. Pick one
   with **SMS + Voice** capabilities (most US numbers have both). It costs
   about **$1–2/month**, and Twilio covers it with your trial credit — you
   pay nothing today.
5. **Write down three things** from the console homepage (top of the
   dashboard):
   - **Account SID** (starts with `AC…`)
   - **Auth Token** (click "show" to reveal it — keep this private, like a password)
   - Your new **phone number** (format: `+1XXXXXXXXXX`)
6. **Test it:** with the YEW app deployed, trigger a test audit call to your
   own verified number. You should get the secret-shopper call. Send a test
   text from the Revive page to your own number too.

If the call arrives and the text arrives, Phase 1 is done.

---

## Phase 2 — Go live with real businesses

Trial accounts can't reach real customer numbers, so before YEW touches a
real business you **upgrade**. This is pay-as-you-go — **no subscription**.

1. In the Twilio console, go to **Billing → Upgrade**. Add about **$20**.
   That's real money, but it goes a long way:
   - ~**2,500 text messages**, or
   - ~**1,000 minutes** of audit calls,
   - or a mix. When it runs low, Twilio can auto–top-up (you set the amount).
2. Your phone number from Phase 1 keeps working — nothing to change there.
3. **Register for 10DLC (required before texting customers).** US carriers
   require businesses that text customers to register — it's about **$15
   one-time**, done inside the console: **Messaging → Regulatory Compliance →
   10DLC**. Twilio walks you through it step by step (business name, what
   you'll text, a sample message). Approval usually takes a few days, so
   **start this early**. Until it's approved, keep texting to verified/test
   numbers only.
4. **Always honor STOP.** If anyone replies STOP (or UNSUBSCRIBE, CANCEL,
   QUIT, END), YEW automatically marks them opted-out and Twilio blocks
   further texts to them. Never text them again — that's federal law (TCPA),
   and the fines are huge. YEW handles this for you; just don't override it.

---

## Connect Twilio to the YEW app (Vercel)

The app needs five values. In Vercel: open your YEW project → **Settings →
Environment Variables**, and add each one (paste exactly, no extra spaces):

| Name | Where to find it | Example |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio console homepage | `ACxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio console homepage (click "show") | `xxxxxxxxxxxxxxxx` |
| `TWILIO_PHONE_NUMBER` | The number you bought | `+15551234567` |
| `SUPABASE_URL` | Supabase → Project Settings → API | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API (the **service_role** key, not anon) | `eyJhbGciOi…` |

After adding them, **redeploy** the app (Vercel → Deployments → Redeploy) so
the new values take effect.

> Optional: if your site ever lives somewhere other than Vercel, add
> `PUBLIC_BASE_URL` = your full site address (e.g.
> `https://yew-yourname.vercel.app`). On Vercel you can skip this.

---

## Point Twilio's webhooks at YEW

Twilio needs to know where to send call/text updates. Replace `YOUR-DOMAIN`
with your real site address (e.g. `yew-yourname.vercel.app`).

**For audit calls** — nothing to set on the number itself. YEW tells Twilio
the webhook address on every call automatically:
- Call status updates → `https://YOUR-DOMAIN/api/audit-status`

**For incoming texts** — set this once on your phone number:
1. Twilio console → **Phone Numbers → Manage → Active numbers** → click your number.
2. Under **Messaging**, find **"A message comes in"**, choose **Webhook**,
   paste `https://YOUR-DOMAIN/api/sms-inbound`, method **HTTP POST**.
3. Click **Save**.

Test again end-to-end: trigger an audit, reply to a Revive text, and watch
the results land in the YEW dashboard.

---

## Quick cost cheat-sheet

| What | Cost |
|---|---|
| Trial (30 days) | Free, no card — testing only |
| Phone number | ~$1–2/month |
| Text message | ~$0.008 each (about 125 texts per $1) |
| Voice minute | ~$0.02/min (about 50 audit minutes per $1) |
| 10DLC registration | ~$15 one-time |
| Typical business, monthly | **$3–8** in Twilio costs vs **$49–99** they pay you |

That's the whole business in one line: it costs you a few dollars per
customer and they pay you $49–99. Keep this page handy when you talk to
investors.
