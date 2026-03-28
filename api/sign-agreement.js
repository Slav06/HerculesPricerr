// Submit agreement signature, recording IP and user agent.

const { supabasePatch, supabaseGet } = require('./_supabase');

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getClientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length) {
        return xff.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || req.connection?.remoteAddress || null;
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
        const { token, signerName, signatureDataUrl } = req.body || {};
        if (!token) {
            cors(res);
            res.status(400).json({ success: false, error: 'Missing token' });
            return;
        }
        if (!signerName) {
            cors(res);
            res.status(400).json({ success: false, error: 'Missing signerName' });
            return;
        }
        if (!signatureDataUrl || typeof signatureDataUrl !== 'string' || !signatureDataUrl.startsWith('data:image/')) {
            cors(res);
            res.status(400).json({ success: false, error: 'Missing signatureDataUrl (data:image/...)' });
            return;
        }

        // Ensure agreement exists and isn't already signed
        const agrResp = await supabaseGet(`/rest/v1/agreements?select=id,status,step_order,job_submission_id&token=eq.${encodeURIComponent(token)}&limit=1`);
        const agreement = (agrResp.ok && Array.isArray(agrResp.data) && agrResp.data[0]) ? agrResp.data[0] : null;
        if (!agreement) {
            cors(res);
            res.status(404).json({ success: false, error: 'Agreement not found' });
            return;
        }
        if (agreement.status === 'signed') {
            cors(res);
            res.status(409).json({ success: false, error: 'Agreement already signed' });
            return;
        }

        const ip = getClientIp(req);
        const ua = req.headers['user-agent'] || null;

        const patchBody = {
            status: 'signed',
            signer_name: signerName,
            signature_data_url: signatureDataUrl,
            signed_at: new Date().toISOString(),
            signer_ip: ip,
            signer_user_agent: ua,
            updated_at: new Date().toISOString(),
        };
        if (req.body.agreementBody && typeof req.body.agreementBody === 'object') {
            patchBody.agreement_body = req.body.agreementBody;
        }
        const patchResp = await supabasePatch(`/rest/v1/agreements?token=eq.${encodeURIComponent(token)}`, patchBody);

        if (!patchResp.ok) {
            cors(res);
            res.status(500).json({ success: false, error: 'Failed to save signature', details: patchResp.data });
            return;
        }

        // Next step token for 3-step flow
        let nextToken = null;
        const stepOrder = agreement.step_order != null ? agreement.step_order : 1;
        const jobId = agreement.job_submission_id;
        if (jobId) {
            const nextResp = await supabaseGet(`/rest/v1/agreements?select=token&job_submission_id=eq.${encodeURIComponent(jobId)}&step_order=eq.${stepOrder + 1}&status=eq.pending&limit=1`);
            if (nextResp.ok && Array.isArray(nextResp.data) && nextResp.data[0]) {
                nextToken = nextResp.data[0].token;
            }
        }

        cors(res);
        res.status(200).json({ success: true, nextToken });
    } catch (err) {
        console.error('sign-agreement error:', err);
        cors(res);
        res.status(500).json({ success: false, error: err.message || 'Internal error' });
    }
};

