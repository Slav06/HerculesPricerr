// Payroll Admin API — backups, audit log, payment ledger
const { supabaseGet, supabasePost, getSupabaseEnv } = require('./_supabase');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const action = req.query.action;

        // ── Create backup snapshot for a week ──
        if (action === 'backup' && req.method === 'POST') {
            const { week_start } = req.body;
            if (!week_start) return res.status(400).json({ error: 'week_start required' });

            const weekEnd = getWeekEnd(week_start);

            // Gather all payroll data for this week
            const [employees, scheduleEntries, commSnapshots, commTokens, hoursConf, ledgerEntries] = await Promise.all([
                supabaseGet('/rest/v1/employees?is_active=eq.true&order=name'),
                supabaseGet(`/rest/v1/schedule_entries?schedule_date=gte.${week_start}&schedule_date=lte.${weekEnd}&order=employee_name,schedule_date`),
                supabaseGet(`/rest/v1/commission_snapshots?week_start=eq.${week_start}&order=employee_name`),
                supabaseGet(`/rest/v1/commission_tokens?week_start=eq.${week_start}`),
                supabaseGet(`/rest/v1/payroll_confirmations?week_start=eq.${week_start}`),
                supabaseGet(`/rest/v1/payment_ledger?week_start=eq.${week_start}&order=employee_name`)
            ]);

            const backup = {
                week_start,
                week_end: weekEnd,
                created_at: new Date().toISOString(),
                employees: normalize(employees),
                schedule_entries: normalize(scheduleEntries),
                commission_snapshots: normalize(commSnapshots),
                commission_tokens: normalize(commTokens),
                hours_confirmations: normalize(hoursConf),
                payment_ledger: normalize(ledgerEntries)
            };

            await supabasePost('/rest/v1/payroll_backups', {
                week_start,
                backup_data: backup
            });

            // Log it
            await logAudit('backup_created', null, week_start, null, null, 'Backup created');

            return res.json({ success: true, backup });
        }

        // ── Download backup ──
        if (action === 'download-backup' && req.method === 'GET') {
            const week_start = req.query.week_start;
            if (!week_start) return res.status(400).json({ error: 'week_start required' });

            const result = await supabaseGet(`/rest/v1/payroll_backups?week_start=eq.${week_start}&order=created_at.desc&limit=1`);
            const data = normalize(result);
            if (!data.length) return res.status(404).json({ error: 'No backup found for this week' });

            return res.json(data[0].backup_data);
        }

        // ── List backups ──
        if (action === 'list-backups' && req.method === 'GET') {
            const result = await supabaseGet('/rest/v1/payroll_backups?select=id,week_start,created_at&order=created_at.desc&limit=52');
            return res.json(normalize(result));
        }

        // ── Record payment ──
        if (action === 'record-payment' && req.method === 'POST') {
            const { employee_name, week_start, hourly_pay, commission_pay, bonus, deductions, total_paid, payment_method, payment_reference, notes } = req.body;
            if (!employee_name || !week_start) return res.status(400).json({ error: 'employee_name and week_start required' });

            const result = await supabasePost('/rest/v1/payment_ledger', {
                employee_name, week_start,
                hourly_pay: hourly_pay || 0,
                commission_pay: commission_pay || 0,
                bonus: bonus || 0,
                deductions: deductions || 0,
                total_paid: total_paid || 0,
                payment_method: payment_method || null,
                payment_reference: payment_reference || null,
                notes: notes || null,
                paid_at: new Date().toISOString()
            });

            await logAudit('payment_recorded', employee_name, week_start, null, null, `Paid $${total_paid} via ${payment_method || 'unspecified'}`);

            return res.json({ success: true, data: normalize(result) });
        }

        // ── Get payment ledger ──
        if (action === 'ledger' && req.method === 'GET') {
            const { week_start, employee_name } = req.query;
            let path = '/rest/v1/payment_ledger?order=paid_at.desc';
            if (week_start) path += `&week_start=eq.${week_start}`;
            if (employee_name) path += `&employee_name=eq.${encodeURIComponent(employee_name)}`;
            if (!week_start && !employee_name) path += '&limit=100';

            const result = await supabaseGet(path);
            return res.json(normalize(result));
        }

        // ── Get audit log ──
        if (action === 'audit-log' && req.method === 'GET') {
            const { week_start, employee_name } = req.query;
            let path = '/rest/v1/payroll_audit_log?order=created_at.desc&limit=200';
            if (week_start) path += `&week_start=eq.${week_start}`;
            if (employee_name) path += `&employee_name=eq.${encodeURIComponent(employee_name)}`;

            const result = await supabaseGet(path);
            return res.json(normalize(result));
        }

        // ── Export CSV ──
        if (action === 'export-csv' && req.method === 'GET') {
            const week_start = req.query.week_start;
            if (!week_start) return res.status(400).json({ error: 'week_start required' });

            const ledger = await supabaseGet(`/rest/v1/payment_ledger?week_start=eq.${week_start}&order=employee_name`);
            const rows = normalize(ledger);

            let csv = 'Employee,Week,Hourly Pay,Commission,Bonus,Deductions,Total Paid,Method,Reference,Notes,Paid At\n';
            for (const r of rows) {
                csv += `"${r.employee_name}","${r.week_start}",${r.hourly_pay},${r.commission_pay},${r.bonus},${r.deductions},${r.total_paid},"${r.payment_method || ''}","${r.payment_reference || ''}","${(r.notes || '').replace(/"/g, '""')}","${r.paid_at}"\n`;
            }

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=payroll_${week_start}.csv`);
            return res.send(csv);
        }

        return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
        console.error('Payroll admin error:', err);
        return res.status(500).json({ error: err.message });
    }
};

function normalize(result) {
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.data)) return result.data;
    return [];
}

function getWeekEnd(weekStart) {
    const d = new Date(weekStart + 'T00:00:00Z');
    d.setDate(d.getDate() + 6);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

async function logAudit(action, employeeName, weekStart, field, oldVal, newVal) {
    try {
        await supabasePost('/rest/v1/payroll_audit_log', {
            action,
            employee_name: employeeName,
            week_start: weekStart,
            field_changed: field,
            old_value: oldVal ? String(oldVal) : null,
            new_value: newVal ? String(newVal) : null
        });
    } catch(e) { console.error('Audit log failed:', e); }
}
