// POST /api/revive-kickoff   body: { "campaign_id": "uuid" }
// Sends msg_day0 to every pending lead in the campaign, logging each send.
const { env, readBody, sb, twilio, json } = require('./_lib');

function fill(tpl, lead) {
  return String(tpl || '')
    .replace(/\{\{name\}\}/gi, (lead.name || 'there').split(' ')[0])
    .replace(/\{\{service\}\}/gi, lead.service || 'your project');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
  try {
    const { campaign_id } = await readBody(req);
    if (!campaign_id) return json(res, 400, { ok: false, error: 'campaign_id required' });

    const db = sb();
    const camps = await db.get('campaigns', { id: `eq.${campaign_id}`, select: 'id,msg_day0,status' });
    if (!camps.length) return json(res, 404, { ok: false, error: 'campaign not found' });

    const leads = await db.get('leads', {
      campaign_id: `eq.${campaign_id}`, status: 'eq.pending',
      select: 'id,name,phone,service',
    });

    const tw = twilio();
    const from = env('TWILIO_PHONE_NUMBER');
    let sent = 0;
    const errors = [];
    for (const lead of leads) {
      if (!lead.phone) continue;
      const body = fill(camps[0].msg_day0, lead) + '\nReply STOP to opt out.';
      try {
        const msg = await tw.post('/Messages.json', { To: lead.phone, From: from, Body: body });
        await db.insert('messages', [{ lead_id: lead.id, direction: 'out', body, twilio_sid: msg.sid }]);
        await db.patch('leads', { id: `eq.${lead.id}` },
          { status: 'sent_1', last_sent_at: new Date().toISOString() });
        sent++;
      } catch (e) { errors.push(lead.phone + ': ' + e.message); }
    }
    return json(res, 200, { ok: true, sent, errors: errors.slice(0, 5) });
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message });
  }
};
