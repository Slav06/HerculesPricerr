// Dialerr Webhook — receives disposition events, updates job_submissions
const { getSupabaseEnv, supabaseGet, supabasePost, supabasePatch } = require('./_supabase');

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Dialr-Event, X-Dialr-Timestamp, X-Dialr-Organization');
}

// Normalize phone to digits only for matching
function normalizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '').replace(/^1(\d{10})$/, '$1'); // strip leading 1 for US
}

// Map Dialerr disposition names to our status keys
// Dynamic disposition → status mapping from Supabase dispositions table
// Falls back to hardcoded defaults if no DB match
async function mapDispositionToStatus(dispName) {
    const cleanName = (dispName || '').replace(/[:：]+/g, '').trim();
    if (!cleanName) return 'new_lead';

    // Try DB lookup first — dispositions table has maps_to_status field
    const result = await supabaseGet(
        `/rest/v1/dispositions?name=ilike.${encodeURIComponent(cleanName)}&select=name,maps_to_status&limit=1`
    );
    if (result.data && result.data.length > 0 && result.data[0].maps_to_status) {
        return result.data[0].maps_to_status;
    }

    // Fallback hardcoded map
    const name = cleanName.toLowerCase();
    const fallback = {
        'no answer': 'no_answer',
        'voicemail': 'voicemail',
        'quoted': 'quoted',
        'transferred to closer': 'transferred',
        'won': 'won',
        'booked': 'won',
        'dropped': 'dropped',
        'booked to competitor': 'booked_to_competitor',
        'not interested': 'dropped',
        'callback': 'no_answer',
        'scheduled callback': 'no_answer',
        'busy': 'no_answer',
        'busy signal': 'no_answer',
        'wrong number': 'dropped',
        'disconnected': 'dropped',
        'technical issue': 'new_lead',
        'hung up': 'dropped',
    };
    return fallback[name] || 'new_lead';
}

// Get wait times for a status from job_status_tiers
async function getWaitTimes(statusKey) {
    const result = await supabaseGet(
        `/rest/v1/job_status_tiers?status_key=eq.${encodeURIComponent(statusKey)}&select=max_attempts,wait_times_json,priority_score&limit=1`
    );
    if (!result.data || !result.data.length) return null;
    const row = result.data[0];
    let waitTimes = [];
    try { waitTimes = JSON.parse(row.wait_times_json || '[]'); } catch(e) {}
    return {
        maxAttempts: row.max_attempts || 0,
        waitTimes,
        priorityScore: row.priority_score || 50,
    };
}

module.exports = async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method === 'GET') return res.status(200).json({ status: 'ok', message: 'Dialerr webhook endpoint active' });
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const event = req.headers['x-dialr-event'] || req.body?.event || req.body?.type || '';
    const body = req.body || {};
    const data = body.data || body;

    // Log EVERY incoming webhook for debugging — save raw payload
    console.log('📞 Dialerr webhook received:', JSON.stringify({ event, headers: req.headers, body }).slice(0, 2000));
    try {
        await supabasePost('/rest/v1/dialerr_webhook_logs', {
            phone: data.lead?.phone || data.phone || body.phone || null,
            disposition_name: data.disposition?.name || data.disposition_name || body.disposition || null,
            match_status: 'raw_log',
            raw_payload: body,
        });
    } catch (e) { /* don't fail on log errors */ }

    // Extract common fields early for dedup
    const callObj = data.call || body.call || {};
    const leadObj = data.lead || data.contact || body.lead || body;
    const callIdForDedup = callObj.id || data.callId || body.callId || null;
    const incomingRecording = callObj.recordingUrl || callObj.recording_url || data.recordingUrl || null;
    const earlyPhone = normalizePhone(leadObj.phone);

    // Deduplicate — Dialerr fires twice within seconds (callIds may differ slightly)
    // Match by phone + processed within last 30 seconds
    if (earlyPhone) {
        const thirtySecsAgo = new Date(Date.now() - 30000).toISOString();
        const dupCheck = await supabaseGet(
            `/rest/v1/dialerr_webhook_logs?match_status=eq.processed&phone=ilike.%25${earlyPhone.slice(-10)}%25&created_at=gt.${thirtySecsAgo}&limit=1`
        );
        if (dupCheck.data && dupCheck.data.length > 0) {
            // Already processed — but if this one has a recording, attach it to the existing note
            if (incomingRecording) {
                const jobResult = await supabaseGet(
                    `/rest/v1/job_submissions?or=(phone.ilike.%25${earlyPhone.slice(-10)}%25)&select=id,job_number&order=submitted_at.desc&limit=1`
                );
                const matchedJob = jobResult.data && jobResult.data.length ? jobResult.data[0] : null;
                if (matchedJob) {
                    const existingNotes = await supabaseGet(
                        `/rest/v1/job_notes?job_submission_id=eq.${matchedJob.id}&author_name=eq.Dialerr&order=created_at.desc&limit=1`
                    );
                    const recordingHtml = `\n🔊 <audio controls src="${incomingRecording}" style="height:24px;vertical-align:middle"></audio> <a href="${incomingRecording}" target="_blank">Play</a>`;
                    if (existingNotes.data && existingNotes.data.length > 0 && !existingNotes.data[0].body.includes('audio')) {
                        await supabasePatch(`/rest/v1/job_notes?id=eq.${existingNotes.data[0].id}`, {
                            body: existingNotes.data[0].body + recordingHtml
                        }).catch(() => {});
                    }
                }
                return res.status(200).json({ success: true, type: 'recording_attached' });
            }
            return res.status(200).json({ success: true, skipped: true, reason: 'duplicate' });
        }
    }

    // Determine event type
    const isDispositionSet = !event || event === 'lead.disposition_set';
    const isDispositionUpdated = event === 'lead.disposition_updated';

    // Extract disposition data — handle various Dialerr payload formats
    const disposition = data.disposition || body.disposition || {};
    const lead = data.lead || data.contact || body.lead || body;
    const call = data.call || body.call || {};
    const agent = data.agent || body.agent || {};
    const agentName = agent.name || agent.email || null;
    const callId = call.id || data.callId || body.callId || null;
    const recordingUrl = call.recordingUrl || call.recording_url || data.recordingUrl || null;
    const followUpDate = data.follow_up_date || data.callback_time || data.next_call_time ||
        body.follow_up_date || body.callback_time || body.next_call_time || null;

    const dispName = disposition.name || (typeof disposition === 'string' ? disposition : '') ||
        data.disposition_name || body.disposition_name || body.last_disposition_name || '';
    const phone = normalizePhone(lead.phone);
    const email = (lead.email || '').trim().toLowerCase();
    const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();

    if (!phone && !email) {
        return res.status(200).json({ success: false, error: 'No phone or email to match' });
    }

    // Deduplicate: if this is lead.disposition_updated (recording follow-up),
    // only attach recording — don't re-process the disposition
    if (isDispositionUpdated && callId) {
        // Find the existing log entry by callId and attach recording
        const existingLog = await supabaseGet(
            `/rest/v1/dialerr_webhook_logs?raw_payload->>callId=eq.${callId}&match_status=neq.raw_log&limit=1`
        );
        // Just log it and return — don't update job status again
        try {
            await supabasePost('/rest/v1/dialerr_webhook_logs', {
                phone: lead.phone || null,
                disposition_name: dispName || 'recording_update',
                match_status: 'recording_update',
                raw_payload: body,
            });
        } catch (e) { /* ignore */ }

        // If we have a recording URL and a matched job, save it to the note
        if (recordingUrl) {
            // Find the job to attach recording
            let matchQuery = '';
            if (phone) {
                matchQuery = `/rest/v1/job_submissions?or=(phone.ilike.%25${phone.slice(-10)}%25)&select=id,job_number&order=submitted_at.desc&limit=1`;
            } else {
                matchQuery = `/rest/v1/job_submissions?email=ilike.${encodeURIComponent(email)}&select=id,job_number&order=submitted_at.desc&limit=1`;
            }
            const jobResult = await supabaseGet(matchQuery);
            const matchedJob = jobResult.data && jobResult.data.length ? jobResult.data[0] : null;
            if (matchedJob) {
                await supabasePost('/rest/v1/job_notes', {
                    job_submission_id: matchedJob.id,
                    job_number: matchedJob.job_number,
                    author_name: 'Dialerr',
                    body: `📞 Call recording: ${recordingUrl}`,
                }).catch(() => {});
            }
        }

        return res.status(200).json({ success: true, type: 'recording_update', callId, recordingUrl });
    }

    // Find matching job_submission by phone (primary) or email (fallback)
    let matchQuery = '';
    if (phone) {
        // Match phone with or without country code, dashes, spaces etc
        matchQuery = `/rest/v1/job_submissions?or=(phone.ilike.%25${phone.slice(-10)}%25)&select=id,job_number,status,callback_attempt,phone,email,customer_name&order=submitted_at.desc&limit=1`;
    } else {
        matchQuery = `/rest/v1/job_submissions?email=ilike.${encodeURIComponent(email)}&select=id,job_number,status,callback_attempt,phone,email,customer_name&order=submitted_at.desc&limit=1`;
    }

    const matchResult = await supabaseGet(matchQuery);
    const job = matchResult.data && matchResult.data.length ? matchResult.data[0] : null;

    if (!job) {
        // Log unmatched disposition for review
        console.log('Dialerr webhook: no matching job for', { phone, email, dispName, leadName });
        await supabasePost('/rest/v1/sandy_knowledge', {
            category: 'process',
            title: 'Unmatched Dialerr disposition',
            content: `Disposition "${dispName}" for ${leadName} (${lead.phone || email}) — no matching job found in system.`,
            source_channel: 'dialerr-webhook',
            confidence: 0.5,
        }).catch(() => {});
        return res.status(200).json({ success: false, error: 'No matching job found', phone, email });
    }

    // Map disposition to our status (checks DB first, then fallback)
    const newStatus = await mapDispositionToStatus(dispName);
    const prevStatus = job.status;

    // Calculate callback — prefer Dialerr's follow_up_date, fall back to our wait time rules
    let newAttempt = (newStatus === prevStatus) ? (job.callback_attempt || 0) + 1 : 1;
    let callbackPatch = {};

    if (followUpDate) {
        // Agent set a specific callback time in Dialerr — use it directly
        const cb = new Date(followUpDate);
        callbackPatch = {
            callback_datetime: cb.toISOString(),
            callback_date: cb.toISOString().split('T')[0],
            callback_time: cb.toTimeString().slice(0, 5),
            callback_attempt: newAttempt,
        };
    } else {
        // No follow-up from Dialerr — use our local wait time rules
        const rules = await getWaitTimes(newStatus);
        if (rules && rules.waitTimes.length > 0) {
            const maxAtt = rules.maxAttempts || 0;
            if (maxAtt > 0 && newAttempt > maxAtt) {
                callbackPatch = {
                    callback_datetime: null,
                    callback_date: null,
                    callback_time: null,
                    callback_attempt: newAttempt,
                };
            } else {
                const waitIdx = Math.min(newAttempt - 1, rules.waitTimes.length - 1);
                const waitMinutes = rules.waitTimes[waitIdx] || 60;
                const nextCallback = new Date(Date.now() + waitMinutes * 60000);
                callbackPatch = {
                    callback_datetime: nextCallback.toISOString(),
                    callback_date: nextCallback.toISOString().split('T')[0],
                    callback_time: nextCallback.toTimeString().slice(0, 5),
                    callback_attempt: newAttempt,
                };
            }
        } else {
            callbackPatch = { callback_attempt: newAttempt };
        }
    }

    // Don't downgrade status — non-actionable dispositions (no answer, voicemail, busy)
    // should not override meaningful statuses (booked, dropped, disqualified, etc.)
    const noChangeDispositions = ['new_lead']; // statuses that are "neutral" — shouldn't override real ones
    const protectedStatuses = ['won', 'dropped', 'booked_to_competitor'];
    const shouldKeepStatus = noChangeDispositions.includes(newStatus) && protectedStatuses.includes(prevStatus);
    const finalStatus = shouldKeepStatus ? prevStatus : newStatus;

    // Update the job
    const updatePayload = {
        status: finalStatus,
        updated_at: new Date().toISOString(),
        ...callbackPatch,
    };

    const updateResult = await supabasePatch(
        `/rest/v1/job_submissions?id=eq.${job.id}`,
        updatePayload
    );

    // Log as a job note
    const durSec = call.duration != null ? call.duration : null;
    const callDuration = durSec != null ? `${Math.floor(durSec / 60)}m ${durSec % 60}s` : 'unknown';
    const recording = call.recordingUrl || call.recording_url || null;
    const cbSource = followUpDate ? 'set by agent in Dialerr' : (callbackPatch.callback_datetime ? 'auto from rules' : 'none');
    let noteBody = `[${dispName}]${agentName ? ' by ' + agentName : ''} — Call: ${callDuration}` + (finalStatus !== prevStatus ? `, Status: ${prevStatus} → ${finalStatus}` : '');
    if (callbackPatch.callback_datetime) {
        noteBody += ', Next callback: ' + new Date(callbackPatch.callback_datetime).toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' (' + cbSource + ')';
    }
    if (recording) {
        noteBody += `\n🔊 <audio controls src="${recording}" style="height:24px;vertical-align:middle"></audio> <a href="${recording}" target="_blank">Play recording</a>`;
    }
    const noteResult = await supabasePost('/rest/v1/job_notes', {
        job_submission_id: job.id,
        job_number: job.job_number,
        author_name: 'Dialerr',
        body: noteBody,
    }).catch(() => null);

    // Mark as processed for dedup
    try {
        await supabasePost('/rest/v1/dialerr_webhook_logs', {
            phone: lead.phone || null,
            disposition_name: dispName,
            job_number: job.job_number,
            job_id: job.id,
            match_status: 'processed',
            raw_payload: body,
        });
    } catch (e) { /* ignore */ }

    return res.status(200).json({
        success: true,
        matched: {
            jobId: job.id,
            jobNumber: job.job_number,
            customerName: job.customer_name,
        },
        disposition: dispName,
        statusChange: `${prevStatus} → ${newStatus}`,
        callback: callbackPatch.callback_datetime || null,
        attempt: newAttempt,
    });
};
