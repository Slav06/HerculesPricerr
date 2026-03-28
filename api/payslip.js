// Payslip API - Pulls Worksnap hours + commission from transactions
const { supabaseGet, getSupabaseEnv } = require('./_supabase');

const WORKSNAP_TOKEN = 'wfdYOpKEC0SXZejyvyPoBNaL9mpGmpANw6yebVOZ';
const WORKSNAP_PROJECTS = ['120589', '121425']; // Hercules-Moving-Solutions + Outbound HMS

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { week_start, name } = req.query;
        if (!week_start) return res.status(400).json({ error: 'week_start required (YYYY-MM-DD)' });

        // Calculate week range (Mon-Sun)
        const start = new Date(week_start + 'T00:00:00Z');
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const endStr = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;

        // Get employees
        let empQuery = '/rest/v1/employees?is_active=eq.true&order=name';
        if (name) empQuery += `&name=eq.${encodeURIComponent(name)}`;
        const empResult = await supabaseGet(empQuery);
        const employees = Array.isArray(empResult.data) ? empResult.data : (Array.isArray(empResult) ? empResult : []);

        const payslips = [];

        for (const emp of employees) {
            const slip = {
                name: emp.name,
                hourly_rate: parseFloat(emp.hourly_rate) || 0,
                commission_rate: parseFloat(emp.commission_rate) || 0,
                worksnap_id: emp.worksnap_id,
                hours: 0,
                minutes: 0,
                hourly_pay: 0,
                deals: [],
                commission_total: 0,
                total_pay: 0,
                daily_hours: {}
            };

            // Pull Worksnap hours from all projects
            if (emp.worksnap_id) {
                const fromTs = Math.floor(start.getTime() / 1000);
                const toTs = Math.floor(end.getTime() / 1000) + 86400;
                let totalMinutes = 0;

                for (const projectId of WORKSNAP_PROJECTS) {
                    try {
                        const wsResp = await fetch(
                            `https://api.worksnaps.com/api/projects/${projectId}/time_entries.xml?user_ids=${emp.worksnap_id}&from_timestamp=${fromTs}&to_timestamp=${toTs}`,
                            { headers: { Authorization: 'Basic ' + Buffer.from(WORKSNAP_TOKEN + ':ignored').toString('base64') } }
                        );
                        const xml = await wsResp.text();
                        if (xml.includes('error_code')) continue; // User not in this project

                        const entryRegex = /<time_entry>[\s\S]*?<duration_in_minutes>(\d+)<\/duration_in_minutes>[\s\S]*?<from_timestamp>(\d+)<\/from_timestamp>[\s\S]*?<\/time_entry>/g;
                        let match;
                        while ((match = entryRegex.exec(xml)) !== null) {
                            const mins = parseInt(match[1]);
                            const ts = parseInt(match[2]);
                            totalMinutes += mins;
                            const day = new Date(ts * 1000).toISOString().split('T')[0];
                            slip.daily_hours[day] = (slip.daily_hours[day] || 0) + mins;
                        }
                    } catch (e) {
                        console.error(`Worksnap fetch failed for ${emp.name} project ${projectId}:`, e);
                    }
                }

                slip.minutes = totalMinutes;
                slip.hours = Math.round((totalMinutes / 60) * 100) / 100;
                slip.hourly_pay = Math.round(slip.hours * slip.hourly_rate * 100) / 100;
            }

            // Pull manual hours from manual_hours_log for this employee + week
            const manualResult = await supabaseGet(
                `/rest/v1/manual_hours_log?employee_name=eq.${encodeURIComponent(emp.name)}&date=gte.${week_start}&date=lte.${endStr}&select=*&order=date`
            );
            const manualEntries = Array.isArray(manualResult.data) ? manualResult.data : [];
            let manualMinutes = 0;
            const manualDetails = [];
            for (const entry of manualEntries) {
                const mins = entry.duration_minutes || 0;
                manualMinutes += mins;
                const day = entry.date;
                // Track manual hours per day separately
                if (!slip.daily_manual_hours) slip.daily_manual_hours = {};
                slip.daily_manual_hours[day] = (slip.daily_manual_hours[day] || 0) + mins;
                manualDetails.push({
                    date: day,
                    minutes: mins,
                    hours: Math.round((mins / 60) * 100) / 100,
                    reason: entry.reason || null,
                    approved_by: entry.approved_by || null,
                });
            }
            slip.manual_minutes = manualMinutes;
            slip.manual_hours = Math.round((manualMinutes / 60) * 100) / 100;
            slip.manual_pay = Math.round(slip.manual_hours * slip.hourly_rate * 100) / 100;
            slip.manual_entries = manualDetails;

            // Recalculate total including manual hours
            slip.total_hours = Math.round((slip.hours + slip.manual_hours) * 100) / 100;
            slip.total_hourly_pay = Math.round((slip.hourly_pay + slip.manual_pay) * 100) / 100;

            // Pull commission from transactions (fronter1/2 + closer1/2 assignments)
            const encodedName = encodeURIComponent(emp.name);
            const roles = [
                { query: 'fronter_name', pctField: 'fronter_commission_pct', label: 'Fronter' },
                { query: 'fronter2_name', pctField: 'fronter2_commission_pct', label: 'Fronter 2' },
                { query: 'closer_name', pctField: 'closer_commission_pct', label: 'Closer' },
                { query: 'closer2_name', pctField: 'closer2_commission_pct', label: 'Closer 2' }
            ];

            for (const role of roles) {
                const result = await supabaseGet(
                    `/rest/v1/transactions?${role.query}=eq.${encodedName}&processed_at=gte.${week_start}&processed_at=lte.${endStr}T23:59:59&select=id,transaction_id,first_name,last_name,amount,${role.pctField},job_number,processed_at&order=processed_at`
                );
                const txns = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);

                for (const txn of txns) {
                    const amt = parseFloat(txn.amount) || 0;
                    const pct = parseFloat(txn[role.pctField]) || 0;
                    const commission = Math.round(amt * (pct / 100) * 100) / 100;
                    const custName = [txn.first_name, txn.last_name].filter(Boolean).join(' ') || 'Unknown';

                    slip.deals.push({
                        role: role.label,
                        txn_id: txn.transaction_id,
                        job_number: txn.job_number || '-',
                        customer: custName,
                        amount: amt,
                        commission_pct: pct,
                        commission: commission,
                        date: txn.processed_at
                    });
                    slip.commission_total += commission;
                }
            }

            slip.commission_total = Math.round(slip.commission_total * 100) / 100;
            slip.total_pay = Math.round((slip.total_hourly_pay + slip.commission_total) * 100) / 100;

            // Convert daily_hours minutes to hours
            for (const day in slip.daily_hours) {
                slip.daily_hours[day] = Math.round((slip.daily_hours[day] / 60) * 100) / 100;
            }
            if (slip.daily_manual_hours) {
                for (const day in slip.daily_manual_hours) {
                    slip.daily_manual_hours[day] = Math.round((slip.daily_manual_hours[day] / 60) * 100) / 100;
                }
            }

            payslips.push(slip);
        }

        return res.json({ week_start, week_end: endStr, payslips });
    } catch (err) {
        console.error('Payslip API error:', err);
        return res.status(500).json({ error: err.message });
    }
};
