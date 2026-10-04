# YEW — Phone Setup (Twilio)

Good news: the phone system runs on Lotus's side now. You do NOT need to
configure webhooks, environment variables, or anything in Vercel. Three steps:

## Step 1 — Create a free Twilio trial (10 minutes, $0)

1. Go to **twilio.com/try-twilio** and sign up (no credit card needed).
2. Verify your email and your own cell number when it asks.
3. You'll land in the Twilio Console. Your trial includes **100 free texts
   and 75 free call minutes** for 30 days.

Trial limits (why it's test-only): trial accounts can only call/text phone
numbers you verify, and texts use Twilio's template wording. Perfect for
testing YEW on your own number — not for real customers.

## Step 2 — Test it (optional but smart)

1. In the Console, go to **Phone Numbers → Manage → Verified Caller IDs**
   and make sure your cell is verified (it usually is from signup).
2. Tell Lotus "run a test audit on my number" — you'll get a live demo of
   the secret-shopper call and can check the scorecard in your dashboard.

## Step 3 — Go live (~$20, one time)

When you're ready for real businesses:

1. In the Twilio Console, click **Upgrade** (top banner). Add a card and
   load a **$20 starting balance**. There is no subscription — it's
   pay-as-you-go deducted per call/text. That $20 covers roughly
   **2,500 texts or 1,000 audit calls**. One $49/month customer pays for it
   many times over.
2. **Buy a phone number**: Phone Numbers → Manage → Buy a number
   (about $1–2/month, comes out of the balance). Pick one with your area code.
3. Send Lotus these three things from the Console dashboard:
   - **Account SID** (starts with AC…)
   - **Auth Token** (click the eye icon to reveal)
   - **Your new YEW phone number** (starts with +1…)

Lotus plugs them in and the whole system goes live. Nothing for you to
configure anywhere else.

## Before texting real customers — 10DLC (~$15 one-time)

US carriers require businesses to register before sending marketing-style
texts (even friendly follow-ups). In the Console: **Messaging → Regulatory
Compliance → 10DLC → Register a campaign**. It's a guided form, about
$15 one-time, takes a few days to approve. Do this before launching Revive
campaigns for paying customers — it keeps messages delivering and keeps
you compliant. Every YEW text already includes opt-out handling and honors
STOP automatically.
