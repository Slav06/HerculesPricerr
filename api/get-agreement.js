// Fetch agreement + job + inventory by token.

const { supabaseGet } = require('./_supabase');

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        cors(res);
        res.status(200).end();
        return;
    }
    if (req.method !== 'GET') {
        cors(res);
        res.status(405).json({ success: false, error: 'Method not allowed' });
        return;
    }

    try {
        const token = (req.query && req.query.t) || (req.query && req.query.token);
        if (!token) {
            cors(res);
            res.status(400).json({ success: false, error: 'Missing token (?t=...)' });
            return;
        }

        const agrResp = await supabaseGet(`/rest/v1/agreements?select=*&token=eq.${encodeURIComponent(token)}&limit=1`);
        if (!agrResp.ok || !Array.isArray(agrResp.data) || agrResp.data.length === 0) {
            cors(res);
            res.status(404).json({ success: false, error: 'Agreement not found' });
            return;
        }
        const agreement = agrResp.data[0];
        const stepOrder = agreement.step_order != null ? agreement.step_order : 1;

        const jobResp = await supabaseGet(`/rest/v1/job_submissions?select=*&id=eq.${encodeURIComponent(agreement.job_submission_id)}&limit=1`);
        const job = (jobResp.ok && Array.isArray(jobResp.data) && jobResp.data[0]) ? jobResp.data[0] : null;

        // Prefer snapshot; fallback to latest inventory submission
        let inventory = agreement.inventory_snapshot || null;
        if (!inventory) {
            const invResp = await supabaseGet(`/rest/v1/inventory_submissions?select=items,total_volume,updated_at&job_submission_id=eq.${encodeURIComponent(agreement.job_submission_id)}&limit=1`);
            inventory = (invResp.ok && Array.isArray(invResp.data) && invResp.data[0]) ? invResp.data[0].items : null;
        }

        // Next step token (same job, next step_order) — so user can continue or be redirected through completed steps
        let nextToken = null;
        if (stepOrder >= 1 && stepOrder < 3) {
            const nextResp = await supabaseGet(`/rest/v1/agreements?select=token,status&job_submission_id=eq.${encodeURIComponent(agreement.job_submission_id)}&step_order=eq.${stepOrder + 1}&limit=1`);
            if (nextResp.ok && Array.isArray(nextResp.data) && nextResp.data[0]) {
                nextToken = nextResp.data[0].token;
            }
        }

        cors(res);
        res.status(200).json({ success: true, agreement, job, inventory, nextToken });
    } catch (err) {
        console.error('get-agreement error:', err);
        cors(res);
        res.status(500).json({ success: false, error: err.message || 'Internal error' });
    }
};

