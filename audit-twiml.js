// Twilio voice webhook — the script for the YEW AI secret-shopper call.
// Twilio requests this URL when the outbound call connects.
//
// Flow (kept under ~60 seconds total):
//   1. opener    — friendly customer greeting, <Gather input="speech"> their reply
//   2. followup  — "do you have anything this week?" then <Record> up to 20s
//   3. done      — polite sign-off, hang up
//
// Query params carried through each step: business_id, audit_id, business_name.
const _lib = require('./_lib');
const { readBody, escXml, baseUrl, twiml } = _lib;

const VOICE = 'Polly.Joanna'; // natural-sounding voice

function openerTwiml(qs) {
  const nameBit = qs.business_name ? ` Is this ${escXml(qs.business_name)}?` : '';
  const action =
    `/api/audit-twiml?step=followup` +
    `&business_id=${encodeURIComponent(qs.business_id || '')}` +
    `&audit_id=${encodeURIComponent(qs.audit_id || '')}`;
  return `<Response>
  <Gather input="speech" language="en-US" speechTimeout="auto" actionOnEmptyResult="true" action="${action}" method="POST">
    <Say voice="${VOICE}">Hi!${nameBit} I'm looking to book an appointment — is this a good time to talk?</Say>
  </Gather>
  <Say voice="${VOICE}">Sorry, I didn't catch that. I'll try again another time. Thanks!</Say>
  <Hangup/>
</Response>`;
}

function followupTwiml(qs) {
  const base = baseUrl();
  const auditId = encodeURIComponent(qs.audit_id || '');
  const done = `/api/audit-twiml?step=done`;
  // Recording + transcription land on /api/audit-status via these callbacks.
  const recStatus = `${base}/api/audit-status?event=recording&audit_id=${auditId}`;
  const transcribeCb = `${base}/api/audit-status?event=transcription&audit_id=${auditId}`;
  return `<Response>
  <Say voice="${VOICE}">Great, thanks. Do you have anything available this week?</Say>
  <Record maxLength="20" playBeep="true" trim="trim-silence" transcribe="true"
    recordingStatusCallback="${recStatus}" recordingStatusCallbackMethod="POST"
    transcribeCallback="${transcribeCb}" action="${done}" method="POST"/>
  <Say voice="${VOICE}">Thanks so much for your time!</Say>
  <Hangup/>
</Response>`;
}

function doneTwiml() {
  return `<Response>
  <Say voice="${VOICE}">Perfect, thanks so much! I'll check my calendar and call right back.</Say>
  <Hangup/>
</Response>`;
}

module.exports = async (req, res) => {
  try {
    const posted = await readBody(req); // Twilio posts CallSid, SpeechResult, etc.
    const qs = { ...(req.query || {}), ...posted };
    const step = qs.step || 'opener';

    if (step === 'followup') return twiml(res, followupTwiml(qs));
    if (step === 'done') return twiml(res, doneTwiml());
    return twiml(res, openerTwiml(qs));
  } catch (e) {
    return twiml(res, `<Response><Say>Sorry, we're having technical trouble. Goodbye.</Say><Hangup/></Response>`);
  }
};
