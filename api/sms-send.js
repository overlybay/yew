// POST /api/sms-send   body: { "lead_id": "uuid", "body": "message text" }
// Sends one SMS via Twilio, logs it to `messages`, and advances the lead's
// drip status (pending -> sent_1 -> sent_2 -> sent_3). Refuses to text
// leads that opted out.
const { env, readBody, sb, twilio, json } = require('./_lib');

const NEXT = { pending: 'sent_1', sent_1: 'sent_2', sent_2: 'sent_3' };
const TERMINAL = ['replied', 'booked', 'opted_out', 'dead'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  try {
    const { lead_id, body } = await readBody(req);
    if (!lead_id || !body) {
      return json(res, 400, { ok: false, error: 'lead_id and body are required' });
    }

    const db = sb();

    // 1. Load the lead.
    const leads = await db.get('leads', {
      id: `eq.${lead_id}`,
      select: 'id,phone,status,campaign_id',
    });
    if (!leads.length) return json(res, 404, { ok: false, error: 'lead not found' });
    const lead = leads[0];
    if (lead.status === 'opted_out') {
      return json(res, 400, { ok: false, error: 'lead opted out — message not sent' });
    }
    if (!lead.phone) return json(res, 400, { ok: false, error: 'lead has no phone number' });

    // 2. Pick the sending number: the business's YEW number if assigned,
    // otherwise the account default from env.
    let from = env('TWILIO_PHONE_NUMBER', false);
    const camps = await db.get('campaigns', {
      id: `eq.${lead.campaign_id}`,
      select: 'business_id',
    });
    if (camps.length) {
      const biz = await db.get('businesses', {
        id: `eq.${camps[0].business_id}`,
        select: 'twilio_number',
      });
      if (biz.length && biz[0].twilio_number) from = biz[0].twilio_number;
    }
    if (!from) {
      throw new Error('No sending number: set TWILIO_PHONE_NUMBER or the business twilio_number.');
    }

    // 3. Send via Twilio.
    const tw = twilio();
    const msg = await tw.post('/Messages.json', {
      To: lead.phone,
      From: from,
      Body: body,
    });

    // 4. Log + advance drip status (never regress replied/booked).
    await db.insert('messages', [{
      lead_id,
      direction: 'out',
      body,
      twilio_sid: msg.sid,
    }]);
    const nextStatus = TERMINAL.includes(lead.status) ? lead.status : (NEXT[lead.status] || lead.status);
    await db.patch('leads', { id: `eq.${lead_id}` }, {
      status: nextStatus,
      last_sent_at: new Date().toISOString(),
    });

    return json(res, 200, { ok: true, sid: msg.sid, status: nextStatus });
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message });
  }
};
