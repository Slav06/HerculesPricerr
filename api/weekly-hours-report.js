// Monday Weekly Hours Report - Sandy posts verified hours to admin channel
// Cron: every Monday at 10 AM UTC

const { supabaseGet, supabasePost, getSupabaseEnv } = require('./_supabase');
const sbPost = supabasePost;

const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const WORKSNAP_TOKEN = 'wfdYOpKEC0SXZejyvyPoBNaL9mpGmpANw6yebVOZ';
const WORKSNAP_PROJECTS = ['120589', '121425'];
const ADMIN_USER_ID = 'U08KU33TNG7'; // James DM only — never group channels

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // Last week: Monday to Sunday (UTC-based to match payslip API)
        const today = new Date();
        const dayOfWeek = today.getUTCDay();
        const lastMonday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - dayOfWeek - 6));
        const lastSunday = new Date(Date.UTC(lastMonday.getUTCFullYear(), lastMonday.getUTCMonth(), lastMonday.getUTCDate() + 6));

        const weekStart = fmtDate(lastMonday);
        const weekEnd = fmtDate(lastSunday);
        const fromTs = Math.floor(lastMonday.getTime() / 1000);
        const toTs = Math.floor(lastSunday.getTime() / 1000) + 86400;

        // Get employees (optionally filtered by name)
        const singleName = req.query.name || (req.body && req.body.name) || null;
        let empQuery = '/rest/v1/employees?is_active=eq.true&order=name';
        if (singleName) empQuery += `&name=eq.${encodeURIComponent(singleName)}`;
        const empResult = await supabaseGet(empQuery);
        const employees = Array.isArray(empResult.data) ? empResult.data : (Array.isArray(empResult) ? empResult : []);

        let totalHours = 0;
        let totalPay = 0;
        let totalCommission = 0;
        const reports = [];

        for (const emp of employees) {
            let hours = 0;
            const hourlyRate = parseFloat(emp.hourly_rate) || 0;

            // Pull Worksnap hours from all projects
            if (emp.worksnap_id) {
                let totalMinutes = 0;
                for (const projectId of WORKSNAP_PROJECTS) {
                    try {
                        const wsResp = await fetch(
                            `https://api.worksnaps.com/api/projects/${projectId}/time_entries.xml?user_ids=${emp.worksnap_id}&from_timestamp=${fromTs}&to_timestamp=${toTs}`,
                            { headers: { Authorization: 'Basic ' + Buffer.from(WORKSNAP_TOKEN + ':ignored').toString('base64') } }
                        );
                        const xml = await wsResp.text();
                        if (xml.includes('error_code')) continue;

                        const entryRegex = /<duration_in_minutes>(\d+)<\/duration_in_minutes>/g;
                        let match;
                        while ((match = entryRegex.exec(xml)) !== null) {
                            totalMinutes += parseInt(match[1]);
                        }
                    } catch (e) {
                        console.error(`Worksnap failed for ${emp.name} project ${projectId}:`, e);
                    }
                }
                hours = Math.round((totalMinutes / 60) * 100) / 100;
            }

            const hourlyPay = Math.round(hours * hourlyRate * 100) / 100;

            // Pull commission from transactions
            const encodedName = encodeURIComponent(emp.name);
            let commission = 0;
            let dealCount = 0;

            const roleQueries = [
                { field: 'fronter_name', pct: 'fronter_commission_pct' },
                { field: 'fronter2_name', pct: 'fronter2_commission_pct' },
                { field: 'closer_name', pct: 'closer_commission_pct' },
                { field: 'closer2_name', pct: 'closer2_commission_pct' }
            ];

            for (const rq of roleQueries) {
                const result = await supabaseGet(
                    `/rest/v1/transactions?${rq.field}=eq.${encodedName}&processed_at=gte.${weekStart}&processed_at=lte.${weekEnd}T23:59:59&select=amount,${rq.pct}`
                );
                const txns = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
                for (const txn of txns) {
                    commission += (parseFloat(txn.amount) || 0) * ((parseFloat(txn[rq.pct]) || 0) / 100);
                    dealCount++;
                }
            }

            commission = Math.round(commission * 100) / 100;
            const totalEmpPay = Math.round((hourlyPay + commission) * 100) / 100;

            totalHours += hours;
            totalPay += totalEmpPay;
            totalCommission += commission;

            reports.push({ name: emp.name, hours, hourlyRate, hourlyPay, commission, totalPay: totalEmpPay, deals: dealCount });
        }

        totalPay = Math.round(totalPay * 100) / 100;
        totalCommission = Math.round(totalCommission * 100) / 100;
        totalHours = Math.round(totalHours * 100) / 100;

        const weekLabel = `${lastMonday.toLocaleDateString('en-US', {month:'short', day:'numeric'})} - ${lastSunday.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}`;

        // Create pending confirmations + DM each employee their own hours
        for (const r of reports) {
            const emp = employees.find(e => e.name === r.name);
            if (!emp) continue;

            // Create/update confirmation record
            const existing = await supabaseGet(`/rest/v1/payroll_confirmations?employee_name=eq.${encodeURIComponent(r.name)}&week_start=eq.${weekStart}`);
            const existingData = Array.isArray(existing.data) ? existing.data : (Array.isArray(existing) ? existing : []);

            if (!existingData.length) {
                await sbPost('/rest/v1/payroll_confirmations', {
                    employee_name: r.name,
                    week_start: weekStart,
                    status: 'pending'
                });
            }

            if (!emp.slack_user_id) continue;

            let empMsg = `Hey *${r.name}*! 📊\n\n`;
            empMsg += `Here's your hours for *${weekLabel}*:\n\n`;
            empMsg += `🕐 *Total Hours: ${r.hours} hrs*\n`;
            empMsg += `\n⚠️ *Your hours won't be processed until you confirm them.*\n\n`;
            empMsg += `Please reply:\n`;
            empMsg += `• *"confirmed"* or *"yes"* — Hours are correct ✅\n`;
            empMsg += `• *"no"* or tell me what's wrong — I'll flag it for review\n`;

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
                    body: JSON.stringify({ channel: dmData.channel.id, text: empMsg, mrkdwn: true })
                });
            }
        }

        // DM the admin (James) the full private payroll summary — skip for single employee requests
        if (singleName) {
            return res.json({ success: true, week: weekLabel, totalHours, totalPay, totalCommission, reports });
        }
        const ADMIN_USER = 'U08KU33TNG7'; // James
        let adminMsg = `📊 *Weekly Payroll Report (Confidential)*\n`;
        adminMsg += `*Week: ${weekLabel}*\n\n`;

        reports.forEach(r => {
            const check = r.hours > 0 ? '✅' : '⚠️';
            adminMsg += `${check} *${r.name}*\n`;
            adminMsg += `   Hours: *${r.hours} hrs* @ $${r.hourlyRate.toFixed(2)}/hr = *$${r.hourlyPay.toFixed(2)}*\n`;
            if (r.commission > 0) {
                adminMsg += `   Commission: *$${r.commission.toFixed(2)}* (${r.deals} deal${r.deals !== 1 ? 's' : ''})\n`;
            }
            adminMsg += `   💰 *Total: $${r.totalPay.toFixed(2)}*\n\n`;
        });

        adminMsg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        adminMsg += `📋 *Summary:*\n`;
        adminMsg += `   Total Hours: *${totalHours} hrs*\n`;
        adminMsg += `   Total Commission: *$${totalCommission.toFixed(2)}*\n`;
        adminMsg += `   💰 *Total Payroll: $${totalPay.toFixed(2)}*\n\n`;
        adminMsg += `_Hours pulled from Worksnap. Each employee has been messaged to confirm._\n`;
        adminMsg += `_View full payslips: app.herculesmovingsolutions.com/payslips_\n\n`;
        adminMsg += `Reply *"approved"* to confirm payroll, or *"hold [name]"* to flag an issue.`;

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

        return res.json({ success: true, week: weekLabel, totalHours, totalPay, totalCommission, reports });
    } catch (err) {
        console.error('Weekly report error:', err);
        return res.status(500).json({ error: err.message });
    }
};

function fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
