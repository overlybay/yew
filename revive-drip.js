// POST /api/revive-drip   header: x-cron-secret: <CRON_SECRET>
// Daily follow-up sender. Call once a day (scheduler).
//   sent_1 + 4 days  -> msg_day4 -> sent_2
//   sent_2 + 10 days -> msg_day10 -> sent_3
const { env, sb, twilio, json } = require('./_lib');

function fill(tpl, lead) {
  return String(tpl || '')
    .replace(/\{\{name\}\}/gi, (lead.name || 'there').split(' ')[0])
    .replace(/\{\{service\}\}/gi, lead.service || 'your project');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
  const secret = req.headers['x-cron-secret'];
  if (!secret || secret !== env('CRON_SECRET', false)) {
    return json(res, 403, { ok: false, error: 'forbidden' });
  }
  try {
    const db = sb();
    const now = Date.now();
    const dayMs = 86400000;
    const leads = await db.get('leads', {
      status: 'in.(sent_1,sent_2)',
      select: 'id,name,phone,service,status,last_sent_at,campaign_id',
      limit: '200',
    });
    const campCache = {};
    async function camp(id) {
      if (!campCache[id]) {
        const rows = await db.get('campaigns', { id: `eq.${id}`, select: 'id,msg_day4,msg_day10' });
        campCache[id] = rows[0] || null;
      }
      return campCache[id];
    }
    const tw = twilio();
    const from = env('TWILIO_PHONE_NUMBER');
    let sent = 0;
    for (const lead of leads) {
      if (!lead.last_sent_at || !lead.phone) continue;
      const days = (now - new Date(lead.last_sent_at).getTime()) / dayMs;
      const c = await camp(lead.campaign_id);
      if (!c) continue;
      let body = null, next = null;
      if (lead.status === 'sent_1' && days >= 4) { body = c.msg_day4; next = 'sent_2'; }
      else if (lead.status === 'sent_2' && days >= 10) { body = c.msg_day10; next = 'sent_3'; }
      if (!body) continue;
      const text = fill(body, lead) + '\nReply STOP to opt out.';
      try {
        const msg = await tw.post('/Messages.json', { To: lead.phone, From: from, Body: text });
        await db.insert('messages', [{ lead_id: lead.id, direction: 'out', body: text, twilio_sid: msg.sid }]);
        await db.patch('leads', { id: `eq.${lead.id}` },
          { status: next, last_sent_at: new Date().toISOString() });
        sent++;
      } catch (e) { /* continue with the rest */ }
    }
    return json(res, 200, { ok: true, sent });
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message });
  }
};
