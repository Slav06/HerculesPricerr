const { supabaseGet, supabasePost, supabasePatch } = require('./_supabase');

const WORKSNAP_TOKEN = 'wfdYOpKEC0SXZejyvyPoBNaL9mpGmpANw6yebVOZ';
const WORKSNAP_BASE = 'https://api.worksnaps.com/api';
const PROJECT_ID = '120589';

function sendHtml(res, status, message) {
    const color = status === 200 ? '#22c55e' : '#ef4444';
    const icon = status === 200 ? '&#10003;' : '&#10007;';
    res.setHeader('Content-Type', 'text/html');
    return res.status(status).send(`<!DOCTYPE html><html><head><title>Manual Hours</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f8fafc"><div style="text-align:center;padding:2rem;border-radius:12px;background:white;box-shadow:0 4px 12px rgba(0,0,0,0.1);max-width:400px"><div style="font-size:48px;color:${color};margin-bottom:16px">${icon}</div><p style="font-size:18px;color:#1e293b;margin:0">${message}</p></div></body></html>`);
}

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function buildTimeEntryXml(worksnap_id, from_timestamp, duration_in_minutes) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<time_entry>
  <user_id>${worksnap_id}</user_id>
  <from_timestamp>${from_timestamp}</from_timestamp>
  <duration_in_minutes>${duration_in_minutes}</duration_in_minutes>
  <task_id></task_id>
</time_entry>`;
}

async function postToWorksnap(worksnap_id, from_timestamp, duration_in_minutes) {
    const xml = buildTimeEntryXml(worksnap_id, from_timestamp, duration_in_minutes);
    const auth = Buffer.from(`${WORKSNAP_TOKEN}:ignored`).toString('base64');

    const response = await fetch(`${WORKSNAP_BASE}/projects/${PROJECT_ID}/time_entries.xml`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/xml',
            'Authorization': `Basic ${auth}`,
        },
        body: xml,
    });

    const responseText = await response.text();
    return { ok: response.ok, status: response.status, body: responseText };
}

module.exports = async function handler(req, res) {
    setCors(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const action = req.query.action;

    try {
        // ── ADD ──
        if (action === 'add') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

            const { employee_name, worksnap_id, date, hours, minutes, reason, approved_by } = req.body || {};
            if (!worksnap_id || !date) {
                return res.status(400).json({ error: 'worksnap_id and date are required' });
            }

            const h = parseInt(hours) || 0;
            const m = parseInt(minutes) || 0;
            const duration_in_minutes = h * 60 + m;
            if (duration_in_minutes <= 0) {
                return res.status(400).json({ error: 'Duration must be greater than 0' });
            }

            // Convert date string to unix timestamp (start of day UTC)
            const from_timestamp = Math.floor(new Date(date).getTime() / 1000);

            const wsResult = await postToWorksnap(worksnap_id, from_timestamp, duration_in_minutes);

            // Log to Supabase
            await supabasePost('/rest/v1/manual_hours_log', {
                employee_name: employee_name || null,
                worksnap_id: String(worksnap_id),
                date,
                duration_minutes: duration_in_minutes,
                reason: reason || null,
                approved_by: approved_by || null,
                worksnap_response: wsResult.body,
                created_at: new Date().toISOString(),
            });

            if (!wsResult.ok) {
                return res.status(502).json({
                    error: 'Worksnap API error',
                    worksnap_status: wsResult.status,
                    worksnap_body: wsResult.body,
                });
            }

            return res.status(200).json({ success: true, duration_minutes: duration_in_minutes, worksnap_status: wsResult.status });
        }

        // ── PENDING ──
        if (action === 'pending') {
            const result = await supabaseGet('/rest/v1/manual_hours_requests?status=eq.pending&order=created_at.desc');
            if (!result.ok) return res.status(result.status).json({ error: 'Failed to fetch pending requests', details: result.data });
            return res.status(200).json({ requests: result.data });
        }

        // ── REQUEST ──
        if (action === 'request') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

            const { employee_name, worksnap_id, date, hours, minutes, reason, requested_via } = req.body || {};
            if (!employee_name || !worksnap_id || !date) {
                return res.status(400).json({ error: 'employee_name, worksnap_id, and date are required' });
            }

            const h = parseInt(hours) || 0;
            const m = parseInt(minutes) || 0;
            const duration_minutes = h * 60 + m;
            if (duration_minutes <= 0) {
                return res.status(400).json({ error: 'Duration must be greater than 0' });
            }

            const result = await supabasePost('/rest/v1/manual_hours_requests', {
                employee_name,
                worksnap_id: String(worksnap_id),
                date,
                hours: h,
                minutes: m,
                duration_minutes,
                reason: reason || null,
                requested_via: requested_via || null,
                status: 'pending',
                created_at: new Date().toISOString(),
            });

            if (!result.ok) return res.status(result.status).json({ error: 'Failed to create request', details: result.data });

            const requestId = result.data && result.data[0] ? result.data[0].id : null;
            return res.status(200).json({ success: true, request_id: requestId });
        }

        // ── APPROVE ── (supports GET from Slack links + POST)
        if (action === 'approve') {
            const request_id = req.query.request_id || (req.body && req.body.request_id);
            const approved_by = req.query.approved_by || (req.body && req.body.approved_by);
            if (!request_id) {
                if (req.method === 'GET') return sendHtml(res, 400, 'Missing request_id');
                return res.status(400).json({ error: 'request_id is required' });
            }

            // Fetch the request
            const fetchResult = await supabaseGet(`/rest/v1/manual_hours_requests?id=eq.${request_id}`);
            if (!fetchResult.ok || !fetchResult.data || fetchResult.data.length === 0) {
                return res.status(404).json({ error: 'Request not found' });
            }

            const request = fetchResult.data[0];
            if (request.status !== 'pending') {
                if (req.method === 'GET') return sendHtml(res, 200, `This request was already ${request.status}.`);
                return res.status(400).json({ error: `Request is already ${request.status}` });
            }

            // Mark as approved
            await supabasePatch(`/rest/v1/manual_hours_requests?id=eq.${request_id}`, {
                status: 'approved',
                approved_by: approved_by || null,
                approved_at: new Date().toISOString(),
            });

            // Post to Worksnap
            const from_timestamp = Math.floor(new Date(request.date).getTime() / 1000);
            const duration_in_minutes = request.duration_minutes || (parseInt(request.hours) || 0) * 60 + (parseInt(request.minutes) || 0);

            const wsResult = await postToWorksnap(request.worksnap_id, from_timestamp, duration_in_minutes);

            // Log to manual_hours_log
            await supabasePost('/rest/v1/manual_hours_log', {
                employee_name: request.employee_name,
                worksnap_id: String(request.worksnap_id),
                date: request.date,
                duration_minutes: duration_in_minutes,
                reason: request.reason || null,
                approved_by: approved_by || null,
                worksnap_response: wsResult.body,
                created_at: new Date().toISOString(),
            });

            // Update request status to completed (or failed)
            const finalStatus = wsResult.ok ? 'completed' : 'failed';
            await supabasePatch(`/rest/v1/manual_hours_requests?id=eq.${request_id}`, {
                status: finalStatus,
                worksnap_response: wsResult.body,
            });

            if (!wsResult.ok) {
                if (req.method === 'GET') return sendHtml(res, 502, `Approved but Worksnap failed: ${wsResult.body}`);
                return res.status(502).json({ error: 'Approved but Worksnap API failed', worksnap_body: wsResult.body });
            }

            const h = Math.floor(duration_in_minutes / 60);
            const m = duration_in_minutes % 60;
            if (req.method === 'GET') return sendHtml(res, 200, `Approved ${request.employee_name}'s ${h}h ${m}m for ${request.date}. Added to Worksnap.`);
            return res.status(200).json({ success: true, status: 'completed', duration_minutes: duration_in_minutes });
        }

        // ── REJECT ── (supports GET from Slack links + POST)
        if (action === 'reject') {
            const request_id = req.query.request_id || (req.body && req.body.request_id);
            const rejected_by = req.query.rejected_by || (req.body && req.body.rejected_by);
            const reason = req.query.reason || (req.body && req.body.reason);
            if (!request_id) {
                if (req.method === 'GET') return sendHtml(res, 400, 'Missing request_id');
                return res.status(400).json({ error: 'request_id is required' });
            }

            const result = await supabasePatch(`/rest/v1/manual_hours_requests?id=eq.${request_id}`, {
                status: 'rejected',
                rejected_by: rejected_by || null,
                rejection_reason: reason || null,
                rejected_at: new Date().toISOString(),
            });

            if (!result.ok) {
                if (req.method === 'GET') return sendHtml(res, 500, 'Failed to reject request');
                return res.status(result.status).json({ error: 'Failed to reject request', details: result.data });
            }

            if (req.method === 'GET') return sendHtml(res, 200, 'Request rejected.');
            return res.status(200).json({ success: true, status: 'rejected' });
        }

        // ── EMPLOYEES ──
        if (action === 'employees') {
            const result = await supabaseGet('/rest/v1/employees?is_active=eq.true&worksnap_id=not.is.null&select=id,name,worksnap_id,role');
            if (!result.ok) return res.status(result.status).json({ error: 'Failed to fetch employees', details: result.data });
            return res.status(200).json({ employees: result.data });
        }

        return res.status(400).json({ error: 'Invalid action. Use: add, pending, request, approve, reject, employees' });

    } catch (err) {
        console.error('manual-hours error:', err);
        return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
};
