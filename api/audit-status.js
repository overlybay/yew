// Twilio webhook for YEW audit calls. One endpoint handles three event types:
//   ?event=status        (default) call-status callback from /api/audit-call
//   ?event=recording     recordingStatusCallback from the <Record> verb
//   ?event=transcription transcribeCallback from the <Record> verb
// Twilio posts all of these form-encoded. Always answers 200 so Twilio
// never retries in a loop.
const { readBody, sb, twiml, json } = require('./_lib');

module.exports = async (req, res) => {
  try {
    const form = await readBody(req);
    const p = { ...(req.query || {}), ...form };
    const audit_id = p.audit_id;
    const event = p.event || 'status';
    if (!audit_id) return json(res, 400, { ok: false, error: 'audit_id is required' });

    const db = sb();
    const patch = {};

    if (event === 'recording') {
      // RecordingUrl is wav by default; Twilio serves .mp3 with the suffix.
      if (p.RecordingUrl) patch.recording_url = p.RecordingUrl + '.mp3';
      patch.status = 'completed';
      patch.answered = true;
    } else if (event === 'transcription') {
      if (p.TranscriptionText) {
        patch.transcript = p.TranscriptionText;
        // Cheap keyword grading: detect voicemail greetings in the transcript.
        if (/voicemail|leave (a|your) message|after the (tone|beep)/i.test(p.TranscriptionText)) {
          patch.outcome = 'voicemail';
        }
      }
      patch.status = 'completed';
      patch.answered = true;
    } else {
      // Call-status callback. CallStatus is one of:
      // queued | ringing | in-progress | completed | busy | failed | no-answer | canceled
      const st = String(p.CallStatus || '').toLowerCase();

      if (st === 'completed') {
        // Read the row first so we don't clobber an outcome already set
        // by the transcription callback (e.g. 'voicemail').
        const rows = await db.get('audits', { id: `eq.${audit_id}`, select: 'id,outcome' });
        patch.status = 'completed';
        patch.answered = true;
        if (rows.length && !rows[0].outcome) patch.outcome = 'other';
        // NOTE: time_to_answer_sec can't be derived from Twilio's standard
        // status callback (it has no ring-duration field). It stays null in
        // v1; enable Answering Machine Detection or measure client-side if
        // per-second accuracy ever matters.
      } else if (['busy', 'no-answer', 'failed', 'canceled'].includes(st)) {
        patch.status = 'failed';
        patch.answered = false;
        patch.outcome = st === 'busy' ? 'busy' : st === 'no-answer' ? 'no_answer' : 'other';
      } else {
        // Intermediate events (initiated/ringing/in-progress) — acknowledge quietly.
        return twiml(res, '<Response/>');
      }
    }

    if (Object.keys(patch).length) {
      await db.patch('audits', { id: `eq.${audit_id}` }, patch);
    }
    return twiml(res, '<Response/>');
  } catch (e) {
    return json(res, 200, { ok: false, error: e.message });
  }
};
