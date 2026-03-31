// Daily Check-In Cron - Johnny Boombotz checks in with everyone scheduled for tomorrow
// Triggered by Vercel cron at 6 PM daily

const { supabaseGet, getSupabaseEnv } = require('./_supabase');

const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const ADMIN_USER_ID = 'U08KU33TNG7'; // James DM only

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const singleName = req.query.name || (req.body && req.body.name) || null;

        // Check tomorrow's schedule
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;

        let query = `/rest/v1/schedule_entries?schedule_date=eq.${dateStr}&status=neq.callout&order=shift_start`;
        if (singleName) query += `&employee_name=eq.${encodeURIComponent(singleName)}`;
        const result = await supabaseGet(query);
        const entries = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);

        if (!entries.length) {
            return res.json({ success: true, message: 'No one scheduled for tomorrow', date: dateStr });
        }

        const dayLabel = tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        let checked = 0, skipped = 0;

        for (const entry of entries) {
            const empResult = await supabaseGet(`/rest/v1/employees?name=eq.${encodeURIComponent(entry.employee_name)}`);
            const empData = empResult.data || empResult;
            const emp = Array.isArray(empData) ? empData[0] : null;

            if (emp && emp.slack_user_id) {
                // Open DM
                const dmResp = await fetch('https://slack.com/api/conversations.open', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ users: emp.slack_user_id })
                });
                const dmData = await dmResp.json();

                if (dmData.ok && dmData.channel) {
                    const fmtTime = (t) => {
                        if (!t) return '';
                        const [h, m] = t.split(':');
                        const hour = parseInt(h);
                        const ampm = hour >= 12 ? 'PM' : 'AM';
                        const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                        return parseInt(m) === 0 ? `${h12} ${ampm}` : `${h12}:${m} ${ampm}`;
                    };

                    const msg = `Hey *${entry.employee_name}*! 👋\n\n` +
                        `Just checking in — you're scheduled for *${dayLabel}*:\n` +
                        `🕐 *${fmtTime(entry.shift_start)} — ${fmtTime(entry.shift_end)}*\n\n` +
                        `Can you make it?\n` +
                        `• *"yes"* — I'll be there ✅\n` +
                        `• *"no"* — Can't make it\n` +
                        `• *"I can do [time] to [time]"* — I can work different hours`;

                    await fetch('https://slack.com/api/chat.postMessage', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ channel: dmData.channel.id, text: msg, mrkdwn: true })
                    });
                    checked++;
                } else {
                    skipped++;
                }
            } else {
                // No Slack ID
                await fetch('https://slack.com/api/chat.postMessage', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel: await getAdminDmChannel(),
                        text: `⚠️ Can't check in with *${entry.employee_name}* for *${dayLabel}* — no Slack ID linked.`,
                        mrkdwn: true
                    })
                });
                skipped++;
            }
        }

        // Summary to admin DM
        const adminChannel = await getAdminDmChannel();
        if (adminChannel) {
            await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: adminChannel,
                    text: `📋 *Daily Check-In Summary for ${dayLabel}:*\n✅ Checked in with: ${checked} employee(s)\n⚠️ Skipped: ${skipped} (no Slack ID)`,
                    mrkdwn: true
                })
            });
        }

        return res.json({ success: true, date: dateStr, checked, skipped });
    } catch (err) {
        console.error('Check-in cron error:', err);
        return res.status(500).json({ error: err.message });
    }
};

async function getAdminDmChannel() {
    try {
        const resp = await fetch('https://slack.com/api/conversations.open', {
            method: 'POST',
            headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ users: ADMIN_USER_ID })
        });
        const data = await resp.json();
        return data.ok ? data.channel.id : null;
    } catch(e) { return null; }
};
