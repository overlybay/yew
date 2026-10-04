// POST /api/audit-call   body: { "business_id": "uuid" }
// Creates an `audits` row (status='calling') and places the AI secret-shopper
// call to the business via Twilio. The call fetches its instructions from
// /api/audit-twiml and reports back to /api/audit-status.
const { env, readBody, sb, twilio, baseUrl, json } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  try {
    const body = await readBody(req);
    const business_id = body.business_id;
    if (!business_id) return json(res, 400, { ok: false, error: 'business_id is required' });

    const db = sb();

    // 1. Look up the business.
    const bizRows = await db.get('businesses', {
      id: `eq.${business_id}`,
      select: 'id,name,phone',
    });
    if (!bizRows.length) return json(res, 404, { ok: false, error: 'business not found' });
    const biz = bizRows[0];
    if (!biz.phone) return json(res, 400, { ok: false, error: 'business has no phone number' });

    // 2. Create the audit row first, so the status webhook can find it later.
    const today = new Date().toISOString().slice(0, 10);
    const auditRows = await db.insert('audits', [{
      business_id,
      scheduled_for: today,
      status: 'calling',
    }]);
    const audit = auditRows[0];

    // 3. Build absolute webhook URLs (Twilio must reach these over HTTPS).
    const base = baseUrl();
    if (!base) {
      throw new Error('Set PUBLIC_BASE_URL (or deploy on Vercel) so Twilio can reach the webhooks.');
    }
    const twimlUrl =
      `${base}/api/audit-twiml?business_id=${encodeURIComponent(business_id)}` +
      `&audit_id=${encodeURIComponent(audit.id)}` +
      `&business_name=${encodeURIComponent(biz.name || '')}`;
    const statusUrl = `${base}/api/audit-status?audit_id=${encodeURIComponent(audit.id)}`;

    // 4. Place the outbound call.
    const tw = twilio();
    const call = await tw.post('/Calls.json', {
      To: biz.phone,
      From: env('TWILIO_PHONE_NUMBER'),
      Url: twimlUrl,
      Method: 'POST',
      StatusCallback: statusUrl,
      StatusCallbackMethod: 'POST',
      StatusCallbackEvent: 'completed', // only ping us when the call ends
      Timeout: '45', // ring up to 45s before giving up
    });

    // 5. Stash the Twilio call SID for traceability
    // (the v1 audits table has no call_sid column, so ai_notes carries it).
    await db.patch('audits', { id: `eq.${audit.id}` }, {
      ai_notes: `twilio_call_sid=${call.sid}`,
    });

    return json(res, 200, { ok: true, audit_id: audit.id, call_sid: call.sid });
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message });
  }
};
