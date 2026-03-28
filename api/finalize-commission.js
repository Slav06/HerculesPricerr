// Finalize Commission — snapshots commission data for a week and generates employee confirmation links
const { supabaseGet, supabasePost, getSupabaseEnv } = require('./_supabase');
const crypto = require('crypto');

const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const BASE_URL = 'https://app.herculesmovingsolutions.com';

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const action = req.query.action;

        // Finalize a week's commission
        if (req.method === 'POST' && action === 'finalize') {
            const { week_start } = req.body;
            if (!week_start) return res.status(400).json({ error: 'week_start required' });

            const env = getSupabaseEnv();
            const weekEnd = getWeekEnd(week_start);

            // Get all employees
            const empResult = await supabaseGet('/rest/v1/employees?is_active=eq.true&order=name');
            const employees = Array.isArray(empResult.data) ? empResult.data : (Array.isArray(empResult) ? empResult : []);

            const roleQueries = [
                { field: 'fronter_name', pct: 'fronter_commission_pct', label: 'Fronter' },
                { field: 'fronter2_name', pct: 'fronter2_commission_pct', label: 'Fronter 2' },
                { field: 'closer_name', pct: 'closer_commission_pct', label: 'Closer' },
                { field: 'closer2_name', pct: 'closer2_commission_pct', label: 'Closer 2' }
            ];

            // Delete existing snapshots for this week (in case of re-finalize)
            await fetch(`${env.url}/rest/v1/commission_snapshots?week_start=eq.${week_start}`, {
                method: 'DELETE',
                headers: { apikey: env.anonKey, Authorization: `Bearer ${env.anonKey}` }
            });

            let totalSnapshots = 0;
            const employeeTotals = {};

            for (const emp of employees) {
                const encodedName = encodeURIComponent(emp.name);
                let empTotal = 0;

                for (const rq of roleQueries) {
                    const result = await supabaseGet(
                        `/rest/v1/transactions?${rq.field}=eq.${encodedName}&processed_at=gte.${week_start}&processed_at=lte.${weekEnd}T23:59:59&select=transaction_id,first_name,last_name,amount,${rq.pct},job_number,processed_at`
                    );
                    const txns = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);

                    for (const txn of txns) {
                        const amt = parseFloat(txn.amount) || 0;
                        const pct = parseFloat(txn[rq.pct]) || 0;
                        const commission = Math.round(amt * (pct / 100) * 100) / 100;
                        const custName = [txn.first_name, txn.last_name].filter(Boolean).join(' ') || 'Unknown';

                        await supabasePost('/rest/v1/commission_snapshots', {
                            employee_name: emp.name,
                            week_start: week_start,
                            role: rq.label,
                            transaction_id: txn.transaction_id,
                            customer_name: custName,
                            amount: amt,
                            commission_pct: pct,
                            commission_amount: commission,
                            job_number: txn.job_number,
                            processed_at: txn.processed_at
                        });
                        empTotal += commission;
                        totalSnapshots++;
                    }
                }

                if (empTotal > 0) {
                    employeeTotals[emp.name] = Math.round(empTotal * 100) / 100;
                }
            }

            // Generate tokens for employees who have commission
            const tokens = {};
            for (const name of Object.keys(employeeTotals)) {
                const token = crypto.randomBytes(24).toString('hex');
                const encodedName = encodeURIComponent(name);

                // Delete existing token for this week
                await fetch(`${env.url}/rest/v1/commission_tokens?employee_name=eq.${encodedName}&week_start=eq.${week_start}`, {
                    method: 'DELETE',
                    headers: { apikey: env.anonKey, Authorization: `Bearer ${env.anonKey}` }
                });

                await supabasePost('/rest/v1/commission_tokens', {
                    employee_name: name,
                    week_start: week_start,
                    token: token,
                    status: 'pending'
                });

                tokens[name] = {
                    url: `${BASE_URL}/confirm-commission?token=${token}`,
                    total: employeeTotals[name]
                };
            }

            // Send links via Sandy DM to each employee
            for (const emp of employees) {
                if (!emp.slack_user_id || !tokens[emp.name]) continue;

                const msg = `Hey *${emp.name}*! 💰\n\n` +
                    `Your commission for the week of *${week_start}* has been finalized.\n\n` +
                    `Please review and confirm here:\n` +
                    `${BASE_URL}/confirm-commission\n\n` +
                    `Log in with your name and secret key to see your deals.\n` +
                    `⚠️ *Commission won't be paid until you confirm it.*`;

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
                }
            }

            return res.json({ success: true, snapshots: totalSnapshots, tokens, employeeTotals });
        }

        // Get commission snapshot for a token (employee confirmation page)
        if (req.method === 'GET' && action === 'view') {
            const token = req.query.token;
            if (!token) return res.status(400).json({ error: 'token required' });

            const tokenResult = await supabaseGet(`/rest/v1/commission_tokens?token=eq.${token}`);
            const tokenData = Array.isArray(tokenResult.data) ? tokenResult.data : (Array.isArray(tokenResult) ? tokenResult : []);
            if (!tokenData.length) return res.status(404).json({ error: 'Invalid or expired token' });

            const ct = tokenData[0];
            const snapshotResult = await supabaseGet(
                `/rest/v1/commission_snapshots?employee_name=eq.${encodeURIComponent(ct.employee_name)}&week_start=eq.${ct.week_start}&order=processed_at`
            );
            const snapshots = Array.isArray(snapshotResult.data) ? snapshotResult.data : (Array.isArray(snapshotResult) ? snapshotResult : []);

            return res.json({
                employee_name: ct.employee_name,
                week_start: ct.week_start,
                status: ct.status,
                confirmed_at: ct.confirmed_at,
                deals: snapshots,
                total: snapshots.reduce((sum, s) => sum + (parseFloat(s.commission_amount) || 0), 0)
            });
        }

        // Confirm commission
        if (req.method === 'POST' && action === 'confirm') {
            const { token } = req.body;
            if (!token) return res.status(400).json({ error: 'token required' });

            const env = getSupabaseEnv();
            await fetch(`${env.url}/rest/v1/commission_tokens?token=eq.${token}`, {
                method: 'PATCH',
                headers: { apikey: env.anonKey, Authorization: `Bearer ${env.anonKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
                body: JSON.stringify({ status: 'confirmed', confirmed_at: new Date().toISOString() })
            });

            return res.json({ success: true });
        }

        // Get confirmation statuses for a week (admin view)
        if (req.method === 'GET' && action === 'statuses') {
            const week_start = req.query.week_start;
            if (!week_start) return res.status(400).json({ error: 'week_start required' });

            const result = await supabaseGet(`/rest/v1/commission_tokens?week_start=eq.${week_start}&select=employee_name,status,confirmed_at`);
            const data = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
            return res.json(data);
        }

        return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
        console.error('Finalize commission error:', err);
        return res.status(500).json({ error: err.message });
    }
};

function getWeekEnd(weekStart) {
    const d = new Date(weekStart + 'T00:00:00Z');
    d.setDate(d.getDate() + 6);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
