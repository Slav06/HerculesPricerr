// Thursday follow-up — remind employees who haven't confirmed their hours
// Cron: every Thursday at 10 AM UTC

const { supabaseGet, getSupabaseEnv } = require('./_supabase');

const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const ADMIN_USER = 'U08KU33TNG7'; // James

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // Find last Monday (the week we're checking)
        const today = new Date();
        const dayOfWeek = today.getUTCDay();
        const lastMonday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - dayOfWeek - 6));
        const weekStart = fmtDate(lastMonday);
        const lastSunday = new Date(Date.UTC(lastMonday.getUTCFullYear(), lastMonday.getUTCMonth(), lastMonday.getUTCDate() + 6));
        const weekLabel = `${lastMonday.toLocaleDateString('en-US', {month:'short', day:'numeric'})} - ${lastSunday.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}`;

        // Get pending confirmations
        const pendingResult = await supabaseGet(`/rest/v1/payroll_confirmations?week_start=eq.${weekStart}&status=eq.pending`);
        const pending = Array.isArray(pendingResult.data) ? pendingResult.data : (Array.isArray(pendingResult) ? pendingResult : []);

        if (!pending.length) {
            return res.json({ success: true, message: 'All hours confirmed', week: weekStart });
        }

        // Get employees for Slack IDs
        const empResult = await supabaseGet('/rest/v1/employees?is_active=eq.true');
        const employees = Array.isArray(empResult.data) ? empResult.data : (Array.isArray(empResult) ? empResult : []);

        let reminded = 0;
        const unconfirmedNames = [];

        for (const p of pending) {
            const emp = employees.find(e => e.name === p.employee_name);
            unconfirmedNames.push(p.employee_name);

            if (!emp || !emp.slack_user_id) continue;

            const msg = `Hey *${p.employee_name}*! ⏰\n\n` +
                `Friendly reminder — your hours for *${weekLabel}* are still unconfirmed.\n\n` +
                `⚠️ *Your hours won't be processed until you confirm them.*\n\n` +
                `Please reply:\n` +
                `• *"confirmed"* — Hours are correct ✅\n` +
                `• Tell me what's wrong and I'll flag it for review`;

            const dmResp = await fetch('https://slack.com/api/conversations.open', {
                method: 'POST',
                headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ users: emp.slack_user_id })
            });
            const dmData = await dmResp.json();
            if (dmData.ok && dmData.channel) {
                await fetch('https://slack.com/api/chat.postMessage', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channel: dmData.channel.id, text: msg, mrkdwn: true })
                });
                reminded++;
            }
        }

        // DM admin about who hasn't confirmed
        if (unconfirmedNames.length > 0) {
            const adminMsg = `⏰ *Hours Confirmation Reminder (${weekLabel})*\n\n` +
                `The following employees have NOT confirmed their hours yet:\n` +
                unconfirmedNames.map(n => `• ⚠️ *${n}*`).join('\n') +
                `\n\nI've sent them a reminder. Their hours won't be paid until confirmed.`;

            const adminDmResp = await fetch('https://slack.com/api/conversations.open', {
                method: 'POST',
                headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ users: ADMIN_USER })
            });
            const adminDm = await adminDmResp.json();
            if (adminDm.ok && adminDm.channel) {
                await fetch('https://slack.com/api/chat.postMessage', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channel: adminDm.channel.id, text: adminMsg, mrkdwn: true })
                });
            }
        }

        return res.json({ success: true, week: weekStart, reminded, unconfirmed: unconfirmedNames });
    } catch (err) {
        console.error('Hours followup error:', err);
        return res.status(500).json({ error: err.message });
    }
};

function fmtDate(d) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
