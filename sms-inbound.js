// Twilio inbound-SMS webhook. In the Twilio console, set the phone number's
// Messaging webhook to POST to https://YOUR-DOMAIN/api/sms-inbound.
//
// Behavior:
//  - Matches the sender (From) to a lead by the last 10 digits of the number.
//  - Logs every inbound message to `messages`.
//  - Any reply flips the lead to 'replied' (that's the win for YEW Revive).
//  - STOP / UNSUBSCRIBE / CANCEL / QUIT / END (any case) flips to 'opted_out'.
//    (Twilio also auto-handles STOP for compliance and blocks future sends.)
// Always answers 200 with empty TwiML so Twilio never retries.
const { readBody, sb, twiml, last10 } = require('./_lib');

const OPT_OUT = /\b(stop|unsubscribe|cancel|quit|end|stopall)\b/i;

module.exports = async (req, res) => {
  try {
    const form = await readBody(req); // Twilio posts form-encoded: From, To, Body, MessageSid...
    const from = form.From || '';
    const to = form.To || '';
    const body = String(form.Body || '').trim();
    if (!from) return twiml(res, '<Response/>');

    const db = sb();
    const from10 = last10(from);
    const to10 = last10(to);

    // Scope the search to the business that owns the receiving number, when known.
    let businessId = null;
    if (to10) {
      const bizs = await db.get('businesses', { select: 'id,twilio_number' });
      const owner = bizs.find((b) => last10(b.twilio_number) === to10);
      if (owner) businessId = owner.id;
    }

    let leads = await db.get('leads', { select: 'id,phone,status,campaign_id,last_sent_at' });
    leads = leads.filter((l) => last10(l.phone) === from10);
    if (businessId) {
      const camps = await db.get('campaigns', {
        business_id: `eq.${businessId}`,
        select: 'id',
      });
      const ids = new Set(camps.map((c) => c.id));
      const scoped = leads.filter((l) => ids.has(l.campaign_id));
      if (scoped.length) leads = scoped;
    }
    // Most recently contacted lead wins if several share a number.
    leads.sort((a, b) => new Date(b.last_sent_at || 0) - new Date(a.last_sent_at || 0));
    const lead = leads[0];

    if (lead) {
      await db.insert('messages', [{
        lead_id: lead.id,
        direction: 'in',
        body,
        twilio_sid: form.MessageSid || null,
      }]);
      const status = OPT_OUT.test(body) ? 'opted_out' : 'replied';
      await db.patch('leads', { id: `eq.${lead.id}` }, { status });
    }
    // If no lead matched, we still ack — it may be a wrong number or a new inquiry.

    return twiml(res, '<Response/>');
  } catch (e) {
    return twiml(res, '<Response/>');
  }
};
