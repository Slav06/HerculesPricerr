// Schedule API - CRUD for work schedules
const { supabaseGet, supabasePost, supabasePatch } = require('./_supabase');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { action } = req.query;

        // GET endpoints
        if (req.method === 'GET') {
            if (action === 'employees') {
                const result = await supabaseGet('/rest/v1/employees?is_active=eq.true&order=name');
                return res.json(result.data || []);
            }

            if (action === 'week') {
                const { start, end } = req.query;
                if (!start || !end) return res.status(400).json({ error: 'start and end dates required' });
                const result = await supabaseGet(`/rest/v1/schedule_entries?schedule_date=gte.${start}&schedule_date=lte.${end}&order=schedule_date,shift_start`);
                return res.json(result.data || []);
            }

            if (action === 'my-schedule') {
                const { name, start, end } = req.query;
                if (!name) return res.status(400).json({ error: 'name required' });
                let path = `/rest/v1/schedule_entries?employee_name=eq.${encodeURIComponent(name)}&order=schedule_date`;
                if (start) path += `&schedule_date=gte.${start}`;
                if (end) path += `&schedule_date=lte.${end}`;
                const result = await supabaseGet(path);
                return res.json(result.data || []);
            }

            if (action === 'swaps') {
                const { name } = req.query;
                let path = '/rest/v1/schedule_swaps?status=eq.pending&order=created_at.desc';
                if (name) path = `/rest/v1/schedule_swaps?or=(requester_name.eq.${encodeURIComponent(name)},target_name.eq.${encodeURIComponent(name)})&order=created_at.desc`;
                const result = await supabaseGet(path);
                return res.json(result.data || []);
            }

            return res.status(400).json({ error: 'Unknown action' });
        }

        // POST endpoints
        if (req.method === 'POST') {
            const body = req.body;

            if (action === 'generate') {
                // Generate a week of schedules from defaults
                return await generateWeek(body, res);
            }

            if (action === 'confirm') {
                const { id } = body;
                const result = await supabasePatch(
                    `/rest/v1/schedule_entries?id=eq.${id}`,
                    { status: 'confirmed', confirmed_at: new Date().toISOString() }
                );
                return res.json({ success: true, data: result.data });
            }

            if (action === 'callout') {
                const { id, reason, employee_name } = body;
                const result = await supabasePatch(
                    `/rest/v1/schedule_entries?id=eq.${id}`,
                    { status: 'callout', callout_reason: reason, updated_at: new Date().toISOString() }
                );
                // Send Slack alert
                await sendSlackCallout(employee_name, reason, body.schedule_date);
                return res.json({ success: true, data: result.data });
            }

            if (action === 'swap-request') {
                const { requester_name, target_name, swap_date, requester_shift_start, requester_shift_end, target_shift_start, target_shift_end, message } = body;
                const result = await supabasePost('/rest/v1/schedule_swaps', {
                    requester_name, target_name, swap_date,
                    requester_shift_start, requester_shift_end,
                    target_shift_start, target_shift_end,
                    requester_message: message
                });
                // Notify via Slack
                await sendSlackSwapRequest(requester_name, target_name, swap_date, message);
                return res.json({ success: true, data: result.data });
            }

            if (action === 'swap-respond') {
                const { id, accepted } = body;
                const status = accepted ? 'accepted' : 'declined';
                await supabasePatch(
                    `/rest/v1/schedule_swaps?id=eq.${id}`,
                    { status, responded_at: new Date().toISOString() }
                );

                if (accepted) {
                    // Get the swap details and update schedule entries
                    const swapResult = await supabaseGet(`/rest/v1/schedule_swaps?id=eq.${id}`);
                    const swap = swapResult.data?.[0];
                    if (swap) {
                        // Swap the shifts
                        await supabasePatch(
                            `/rest/v1/schedule_entries?employee_name=eq.${encodeURIComponent(swap.requester_name)}&schedule_date=eq.${swap.swap_date}`,
                            { shift_start: swap.target_shift_start, shift_end: swap.target_shift_end, status: 'swapped', updated_at: new Date().toISOString() }
                        );
                        await supabasePatch(
                            `/rest/v1/schedule_entries?employee_name=eq.${encodeURIComponent(swap.target_name)}&schedule_date=eq.${swap.swap_date}`,
                            { shift_start: swap.requester_shift_start, shift_end: swap.requester_shift_end, status: 'swapped', updated_at: new Date().toISOString() }
                        );
                    }
                }

                return res.json({ success: true, status });
            }

            return res.status(400).json({ error: 'Unknown action' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error('Schedule API error:', err);
        return res.status(500).json({ error: err.message });
    }
};

// Generate a full week of schedule entries from employee defaults
async function generateWeek(body, res) {
    const { week_start } = body; // Monday date string YYYY-MM-DD
    if (!week_start) return res.status(400).json({ error: 'week_start required' });

    const empResult = await supabaseGet('/rest/v1/employees?is_active=eq.true');
    const employees = empResult.data || [];

    const weekStart = new Date(week_start + 'T00:00:00');
    const entries = [];

    // Determine which week number this is (for weekend rotation)
    const yearStart = new Date(weekStart.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((weekStart - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
    const isEvenWeek = weekNum % 2 === 0;

    for (const emp of employees) {
        const days = emp.default_days || [1,2,3,4,5];

        // Add weekday shifts
        for (let d = 0; d < 7; d++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + d);
            const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

            let shouldWork = days.includes(dayOfWeek);

            // Weekend rotation logic
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                shouldWork = false; // Reset, apply rotation below

                // Morning rotation (Andrew & Aubrey)
                if (emp.name === 'Andrew') {
                    shouldWork = (dayOfWeek === 6 && isEvenWeek) || (dayOfWeek === 0 && !isEvenWeek);
                } else if (emp.name === 'Aubrey') {
                    shouldWork = (dayOfWeek === 0 && isEvenWeek) || (dayOfWeek === 6 && !isEvenWeek);
                }
                // Evening rotation (Michael & Adrian)
                else if (emp.name === 'Michael') {
                    shouldWork = (dayOfWeek === 6 && isEvenWeek) || (dayOfWeek === 0 && !isEvenWeek);
                } else if (emp.name === 'Adrian') {
                    shouldWork = (dayOfWeek === 0 && isEvenWeek) || (dayOfWeek === 6 && !isEvenWeek);
                }
            }

            if (shouldWork) {
                const dateStr = date.toISOString().split('T')[0];
                entries.push({
                    employee_name: emp.name,
                    schedule_date: dateStr,
                    shift_start: emp.default_shift_start,
                    shift_end: emp.default_shift_end,
                    status: 'scheduled'
                });
            }
        }
    }

    // Upsert entries (delete existing for this week first, then insert)
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + 6);
    const endStr = endDate.toISOString().split('T')[0];

    // Delete existing entries for this week
    const { url, anonKey } = require('./_supabase').getSupabaseEnv ? require('./_supabase') : { getSupabaseEnv: () => ({}) };
    const { getSupabaseEnv } = require('./_supabase');
    const env = getSupabaseEnv();
    await fetch(`${env.url}/rest/v1/schedule_entries?schedule_date=gte.${week_start}&schedule_date=lte.${endStr}`, {
        method: 'DELETE',
        headers: {
            apikey: env.anonKey,
            Authorization: `Bearer ${env.anonKey}`,
        }
    });

    // Insert new entries
    if (entries.length > 0) {
        const result = await supabasePost('/rest/v1/schedule_entries', entries);
        return res.json({ success: true, count: entries.length, data: result.data });
    }

    return res.json({ success: true, count: 0 });
}

// Slack notification helpers
async function sendSlackCallout(employeeName, reason, date) {
    try {
        const config = require('../schedule-config');
        const botToken = config.slack.botToken;
        const webhookUrl = process.env.SLACK_WEBHOOK_URL;

        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: `🚨 *Schedule Alert: ${employeeName} called out*`,
                attachments: [{
                    color: '#dc3545',
                    fields: [
                        { title: 'Employee', value: employeeName, short: true },
                        { title: 'Date', value: date, short: true },
                        { title: 'Reason', value: reason || 'No reason given', short: false }
                    ],
                    footer: 'Schedule System',
                    ts: Math.floor(Date.now() / 1000)
                }]
            })
        });
    } catch (e) {
        console.error('Slack callout notification failed:', e);
    }
}

async function sendSlackSwapRequest(requester, target, date, message) {
    try {
        const webhookUrl = process.env.SLACK_WEBHOOK_URL;

        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: `🔄 *Shift Swap Request: ${requester} → ${target}*`,
                attachments: [{
                    color: '#ffc107',
                    fields: [
                        { title: 'From', value: requester, short: true },
                        { title: 'To', value: target, short: true },
                        { title: 'Date', value: date, short: true },
                        { title: 'Message', value: message || '-', short: false }
                    ],
                    footer: 'Schedule System',
                    ts: Math.floor(Date.now() / 1000)
                }]
            })
        });
    } catch (e) {
        console.error('Slack swap notification failed:', e);
    }
}
