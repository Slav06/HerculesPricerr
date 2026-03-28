// Create an agreement token/link for a job and snapshot inventory.

const crypto = require('crypto');
const { supabaseGet, supabasePost } = require('./_supabase');

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getBaseUrl(req) {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return `${proto}://${host}`;
}

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        cors(res);
        res.status(200).end();
        return;
    }
    if (req.method !== 'POST') {
        cors(res);
        res.status(405).json({ success: false, error: 'Method not allowed' });
        return;
    }

    try {
        const { jobSubmissionId, jobNumber, customerEmail } = req.body || {};
        if (!jobSubmissionId && !jobNumber && !customerEmail) {
            cors(res);
            res.status(400).json({ success: false, error: 'Provide jobSubmissionId, jobNumber, or customerEmail' });
            return;
        }

        // Helper: try different ways to find the job to avoid "Job not found"
        async function findJob() {
            // 1) By explicit id (jobSubmissionId)
            if (jobSubmissionId) {
                const byId = await supabaseGet(`/rest/v1/job_submissions?select=*&id=eq.${encodeURIComponent(jobSubmissionId)}&limit=1`);
                if (byId.ok && Array.isArray(byId.data) && byId.data.length > 0) return byId.data[0];
            }
            // 2) By job_number
            if (jobNumber) {
                const byJobNo = await supabaseGet(`/rest/v1/job_submissions?select=*&job_number=eq.${encodeURIComponent(jobNumber)}&limit=1`);
                if (byJobNo.ok && Array.isArray(byJobNo.data) && byJobNo.data.length > 0) return byJobNo.data[0];
            }
            // 3) By customer email (if provided)
            if (customerEmail) {
                const byEmail = await supabaseGet(`/rest/v1/job_submissions?select=*&email=eq.${encodeURIComponent(customerEmail)}&order=submitted_at.desc&limit=1`);
                if (byEmail.ok && Array.isArray(byEmail.data) && byEmail.data.length > 0) return byEmail.data[0];
            }
            return null;
        }

        const job = await findJob();
        if (!job) {
            cors(res);
            res.status(404).json({ success: false, error: 'Job not found' });
            return;
        }

        // Load inventory snapshot (if any)
        const invResp = await supabaseGet(`/rest/v1/inventory_submissions?select=items,total_volume,updated_at&job_submission_id=eq.${encodeURIComponent(job.id)}&limit=1`);
        const inventorySnapshot = (invResp.ok && Array.isArray(invResp.data) && invResp.data[0]) ? invResp.data[0] : null;
        const invItems = inventorySnapshot ? inventorySnapshot.items : null;

        const baseUrl = getBaseUrl(req);
        const steps = [
            { document_type: 'moving_estimate', step_order: 1, agreement_title: 'Moving Estimate' },
            { document_type: 'bill_of_lading', step_order: 2, agreement_title: 'Interstate Bill of Lading' },
            { document_type: 'credit_card_authorization', step_order: 3, agreement_title: 'Credit Card Authorization Form' },
        ];
        const tokens = steps.map(() => crypto.randomBytes(24).toString('hex'));
        const payloads = steps.map((step, i) => ({
            token: tokens[i],
            job_submission_id: job.id,
            job_number: job.job_number || null,
            customer_name: job.customer_name || null,
            customer_email: customerEmail || job.email || null,
            inventory_snapshot: invItems,
            document_type: step.document_type,
            step_order: step.step_order,
            agreement_title: step.agreement_title,
            status: 'pending',
        }));

        const createResp = await supabasePost('/rest/v1/agreements', payloads);

        if (!createResp.ok) {
            const errorMsg = createResp.data?.message || createResp.data?.error || JSON.stringify(createResp.data) || 'Unknown error';
            console.error('Failed to create agreements:', { status: createResp.status, data: createResp.data, jobId: job.id, jobNumber: job.job_number });
            cors(res);
            res.status(500).json({ success: false, error: `Failed to create agreement: ${errorMsg}`, details: createResp.data });
            return;
        }

        const created = Array.isArray(createResp.data) ? createResp.data : [createResp.data];
        const firstAgreement = created[0];
        cors(res);
        res.status(200).json({
            success: true,
            agreementId: firstAgreement?.id || null,
            token: tokens[0],
            link: `${baseUrl}/agreement?t=${tokens[0]}`,
        });
    } catch (err) {
        console.error('create-agreement error:', err);
        cors(res);
        res.status(500).json({ success: false, error: err.message || 'Internal error' });
    }
};

