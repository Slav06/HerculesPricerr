// Vercel serverless function to send email via Resend or Bird (MessageBird)
// Set EMAIL_PROVIDER=resend or EMAIL_PROVIDER=bird in Vercel env.
// Resend: RESEND_API_KEY, optional RESEND_FROM
// Bird: BIRD_ACCESS_KEY, BIRD_WORKSPACE_ID, BIRD_CHANNEL_ID (email channel)

const { Resend } = require('resend');
const { supabasePost } = require('./_supabase');

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
}

async function logEmail(res, to, subject, fromEmail, templateId, status, errorMsg, messageId, meta, htmlBody) {
    try {
        await supabasePost('/rest/v1/email_logs', {
            to_email: Array.isArray(to) ? to.join(',') : to,
            subject: subject || null,
            from_email: fromEmail || null,
            template_id: templateId || null,
            resend_id: messageId || null,
            status,
            error: errorMsg || null,
            job_submission_id: (meta && meta.jobSubmissionId) || null,
            agreement_id: (meta && meta.agreementId) || null,
            agreement_token: (meta && meta.agreementToken) || null,
            html_body: htmlBody || null,
        }, 'minimal');
    } catch (e) {
        // ignore
    }
}

async function sendViaBird(to, subject, html, text, fromAddress, accessKey, workspaceId, channelId) {
    const toList = Array.isArray(to) ? to : [to];
    const body = {
        receiver: {
            contacts: toList.map((email) => ({ identifierValue: typeof email === 'string' ? email : email.email || email })),
        },
        body: {
            type: 'html',
            html: {
                metadata: { subject: subject || '(No subject)' },
                html: html || (text ? `<p>${text.replace(/\n/g, '</p><p>')}</p>` : '<p></p>'),
                text: text || (html ? html.replace(/<[^>]+>/g, ' ').trim() : ''),
            },
        },
    };
    const url = `https://api.bird.com/workspaces/${workspaceId}/channels/${channelId}/messages`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `AccessKey ${accessKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const errMsg = data.message || data.error || data.reason || response.statusText || 'Bird API error';
        return { success: false, error: errMsg, details: data };
    }
    return { success: true, id: data.id || null };
}

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        cors(res);
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        cors(res);
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // Prefer Bird when explicitly set or when all Bird keys exist (so Bird is used after redeploy)
    const wantBird = (process.env.EMAIL_PROVIDER || '').toLowerCase() === 'bird' ||
        (process.env.BIRD_ACCESS_KEY && process.env.BIRD_WORKSPACE_ID && process.env.BIRD_CHANNEL_ID);
    const provider = wantBird ? 'bird' : 'resend';
    const { from, to, subject, html, text, replyTo, templateId, templateVariables, meta } = req.body || {};

    if (!to) {
        cors(res);
        res.status(400).json({
            success: false,
            error: 'Missing required field: to (recipient email or array of emails)',
        });
        return;
    }

    if (!subject && !html && !text && !templateId) {
        cors(res);
        res.status(400).json({
            success: false,
            error: 'Provide subject + (html or text), or templateId + templateVariables',
        });
        return;
    }

    const toStr = Array.isArray(to) ? to.join(',') : to;
    const subjectVal = subject || '(No subject)';
    const fromVal = from || process.env.RESEND_FROM || process.env.BIRD_FROM || 'Hercules <quotes@herculesmovingsolutions.com>';

    try {
        if (provider === 'bird') {
            const accessKey = process.env.BIRD_ACCESS_KEY;
            const workspaceId = process.env.BIRD_WORKSPACE_ID;
            const channelId = process.env.BIRD_CHANNEL_ID;
            if (!accessKey || !workspaceId || !channelId) {
                cors(res);
                res.status(500).json({
                    success: false,
                    error: 'Bird not configured. Set BIRD_ACCESS_KEY, BIRD_WORKSPACE_ID, and BIRD_CHANNEL_ID in Vercel.',
                });
                return;
            }
            const result = await sendViaBird(to, subjectVal, html, text, fromVal, accessKey, workspaceId, channelId);
            if (!result.success) {
                await logEmail(res, toStr, subjectVal, fromVal, templateId, 'failed', result.error, null, meta, html);
                res.status(400).json({ success: false, error: result.error, details: result.details });
                return;
            }
            await logEmail(res, toStr, subjectVal, fromVal, templateId, 'sent', null, result.id, meta, html);
            cors(res);
            res.status(200).json({ success: true, message: 'Email sent successfully', id: result.id });
            return;
        }

        // Resend
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            cors(res);
            res.status(500).json({
                success: false,
                error: 'Email not configured. In Vercel: set BIRD_ACCESS_KEY, BIRD_WORKSPACE_ID, BIRD_CHANNEL_ID (and optionally EMAIL_PROVIDER=bird), then redeploy. Or use Resend with RESEND_API_KEY.',
            });
            return;
        }

        const resend = new Resend(apiKey);
        const payload = {
            to: Array.isArray(to) ? to : [to],
            from: fromVal,
            replyTo: replyTo || undefined,
        };

        if (templateId) {
            payload.template = { id: templateId, variables: templateVariables || {} };
        } else {
            payload.subject = subjectVal;
            if (html) payload.html = html;
            if (text) payload.text = text;
        }

        const { data, error } = await resend.emails.send(payload);

        if (error) {
            await logEmail(res, toStr, subjectVal, fromVal, templateId, 'failed', error.message, null, meta, html);
            cors(res);
            res.status(400).json({ success: false, error: error.message, details: error });
            return;
        }

        await logEmail(res, toStr, subjectVal, fromVal, templateId, 'sent', null, data?.id, meta, html);
        cors(res);
        res.status(200).json({ success: true, message: 'Email sent successfully', id: data?.id || null });
    } catch (err) {
        console.error('Send email error:', err);
        await logEmail(res, toStr, subjectVal, fromVal, templateId, 'failed', err.message, null, meta, html);
        cors(res);
        res.status(500).json({
            success: false,
            error: 'Failed to send email',
            message: err.message,
        });
    }
};
