// LSA Auto-Reply — Claude-powered responses + lead management
const { supabaseGet, supabasePost, getSupabaseEnv } = require('./_supabase');

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;
const MANAGER_ID = process.env.GOOGLE_ADS_MANAGER_ID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const ADMIN_USER_ID = 'U08KU33TNG7';

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const action = req.query.action;

        // Get chatbot profile
        if (action === 'profile') {
            const result = await supabaseGet('/rest/v1/chatbot_profile?id=eq.1');
            const data = normalize(result);
            return res.json(data[0] || { id: 1, profile_text: getDefaultProfile() });
        }

        // Update chatbot profile
        if (action === 'update-profile' && req.method === 'POST') {
            const { profile_text } = req.body;
            const env = getSupabaseEnv();
            await fetch(`${env.url}/rest/v1/chatbot_profile?id=eq.1`, {
                method: 'PATCH',
                headers: { apikey: env.anonKey, Authorization: `Bearer ${env.anonKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
                body: JSON.stringify({ profile_text, updated_at: new Date().toISOString() })
            });
            return res.json({ success: true });
        }

        // Process new leads — send initial auto-reply to MESSAGE leads
        if (action === 'process') {
            const result = await processNewLeads();
            return res.json(result);
        }

        // Send a specific reply to a lead
        if (action === 'reply' && req.method === 'POST') {
            const { lead_resource, message } = req.body;
            if (!lead_resource || !message) return res.status(400).json({ error: 'lead_resource and message required' });
            await sendGoogleReply(lead_resource, message);

            // Store our reply
            const leadIdNum = lead_resource.includes('/') ? lead_resource.split('/').pop() : lead_resource;
            await supabasePost('/rest/v1/lsa_replies', {
                lead_id: leadIdNum,
                lead_resource: lead_resource,
                bot_reply: message,
                replied_at: new Date().toISOString()
            });

            return res.json({ success: true });
        }

        // Update lead status
        if (action === 'update-status' && req.method === 'POST') {
            const { lead_id, status } = req.body;
            // Store in our DB since we can't easily update Google's status
            const env = getSupabaseEnv();
            await fetch(`${env.url}/rest/v1/lsa_lead_notes?lead_id=eq.${lead_id}`, {
                method: 'PATCH',
                headers: { apikey: env.anonKey, Authorization: `Bearer ${env.anonKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
                body: JSON.stringify({ status, updated_at: new Date().toISOString() })
            });
            return res.json({ success: true });
        }

        // Save internal note for a lead
        if (action === 'save-note' && req.method === 'POST') {
            const { lead_id, note, phone, email, name } = req.body;
            const env = getSupabaseEnv();

            // Check if record exists
            const existing = await supabaseGet(`/rest/v1/lsa_lead_notes?lead_id=eq.${lead_id}`);
            const data = normalize(existing);

            if (data.length > 0) {
                const patch = { updated_at: new Date().toISOString() };
                if (note !== undefined) patch.note = note;
                if (phone) patch.phone = phone;
                if (email) patch.email = email;
                if (name) patch.name = name;

                await fetch(`${env.url}/rest/v1/lsa_lead_notes?lead_id=eq.${lead_id}`, {
                    method: 'PATCH',
                    headers: { apikey: env.anonKey, Authorization: `Bearer ${env.anonKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
                    body: JSON.stringify(patch)
                });
            } else {
                await supabasePost('/rest/v1/lsa_lead_notes', {
                    lead_id, note, phone, email, name, created_at: new Date().toISOString()
                });
            }
            return res.json({ success: true });
        }

        // Get notes for leads
        if (action === 'notes') {
            const result = await supabaseGet('/rest/v1/lsa_lead_notes?order=updated_at.desc&limit=200');
            return res.json(normalize(result));
        }

        // Create job submission from lead
        if (action === 'create-job' && req.method === 'POST') {
            const { lead_id, name, phone, email } = req.body;
            const jobNumber = 'LSA-' + lead_id;
            const result = await supabasePost('/rest/v1/job_submissions', {
                job_number: jobNumber,
                customer_name: name || 'LSA Lead ' + lead_id,
                phone: phone || '',
                email: email || '',
                status: 'pending',
                source: 'Google LSA',
                submitted_at: new Date().toISOString()
            });
            return res.json({ success: true, job_number: jobNumber, data: normalize(result) });
        }

        return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
        console.error('LSA auto-reply error:', err);
        return res.status(500).json({ error: err.message });
    }
};

// ─── Process New Leads ───

async function processNewLeads() {
    const accessToken = await getAccessToken();

    // Get MESSAGE leads from last 7 days
    const query = `
        SELECT
            local_services_lead.id,
            local_services_lead.resource_name,
            local_services_lead.lead_type,
            local_services_lead.contact_details,
            local_services_lead.lead_status,
            local_services_lead.creation_date_time
        FROM local_services_lead
        WHERE local_services_lead.lead_type = 'MESSAGE'
        ORDER BY local_services_lead.creation_date_time DESC
        LIMIT 20
    `;

    const resp = await fetch(
        `https://googleads.googleapis.com/v23/customers/${CUSTOMER_ID}/googleAds:search`,
        {
            method: 'POST',
            headers: gadsHeaders(accessToken),
            body: JSON.stringify({ query })
        }
    );

    const data = await resp.json();
    const results = data.results || [];
    let replied = 0, skipped = 0;

    for (const r of results) {
        const lead = r.localServicesLead;
        if (!lead) continue;

        // Check if we already replied
        const existing = await supabaseGet(`/rest/v1/lsa_replies?lead_id=eq.${lead.id}`);
        if (normalize(existing).length > 0) { skipped++; continue; }

        // Check how many conversations exist — if advertiser already replied, skip
        const convoQuery = `
            SELECT local_services_lead_conversation.id, local_services_lead_conversation.participant_type
            FROM local_services_lead_conversation
            WHERE local_services_lead_conversation.lead = '${lead.resourceName}'
        `;
        const convoResp = await fetch(
            `https://googleads.googleapis.com/v23/customers/${CUSTOMER_ID}/googleAds:search`,
            { method: 'POST', headers: gadsHeaders(accessToken), body: JSON.stringify({ query: convoQuery }) }
        );
        const convoData = await convoResp.json();
        const convos = convoData.results || [];
        const hasAdvertiserReply = convos.some(c => c.localServicesLeadConversation?.participantType === 'ADVERTISER');

        if (hasAdvertiserReply) { skipped++; continue; }

        // Generate and send intro message
        const customerName = lead.contactDetails?.consumerName || '';
        const reply = await generateIntroMessage(customerName);

        try {
            await sendGoogleReply(lead.resourceName, reply);
            await supabasePost('/rest/v1/lsa_replies', {
                lead_id: lead.id,
                lead_resource: lead.resourceName,
                customer_name: customerName,
                bot_reply: reply,
                replied_at: new Date().toISOString()
            });
            replied++;

            // Alert admin via Sandy DM
            await sendAdminDM(`📩 *New LSA Message Lead*\nName: ${customerName || 'Unknown'}\nPhone: ${lead.contactDetails?.phoneNumber || '—'}\nEmail: ${lead.contactDetails?.email || '—'}\nStatus: ${lead.leadStatus}\n\nAuto-reply sent.`);
        } catch (e) {
            console.error(`Failed to reply to lead ${lead.id}:`, e);
        }
    }

    return { processed: results.length, replied, skipped };
}

// ─── Generate Intro Message with Claude ───

async function generateIntroMessage(customerName) {
    // Fetch chatbot profile
    const profileResult = await supabaseGet('/rest/v1/chatbot_profile?id=eq.1');
    const profileData = normalize(profileResult);
    const profile = profileData[0]?.profile_text || getDefaultProfile();

    const greeting = customerName ? `Hi ${customerName}!` : 'Hi there!';

    const systemPrompt = `You are a friendly customer service rep for Hercules Moving Solutions (HMS). A customer just messaged you through Google Local Services Ads. You can't see their message, so you need to send a warm, engaging intro that:

1. Thanks them for reaching out
2. Introduces HMS briefly
3. Asks for their info so you can send them a personalized moving quote

BUSINESS PROFILE:
${profile}

RULES:
- Keep it SHORT — 3-4 sentences max
- Be warm and personal, not corporate
- ALWAYS ask for: their email address (to send the quote) and best phone number to reach them
- Mention that you'll put together a free, no-obligation quote
- Don't mention you're an AI or bot
- Don't make up pricing
- Start with "${greeting}"`;

    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 200,
            system: systemPrompt,
            messages: [{ role: 'user', content: 'Generate the intro message.' }]
        })
    });

    const claudeData = await claudeResp.json();
    return claudeData.content?.[0]?.text || `${greeting} Thanks for reaching out to Hercules Moving Solutions! We'd love to help with your move. Could you share your email address and best phone number? We'll put together a free, personalized moving quote for you right away.`;
}

// ─── Helpers ───

function gadsHeaders(accessToken) {
    return {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': DEVELOPER_TOKEN,
        'login-customer-id': MANAGER_ID,
        'Content-Type': 'application/json'
    };
}

async function getAccessToken() {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
            refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token'
        })
    });
    const data = await resp.json();
    if (data.error) throw new Error(`OAuth: ${data.error}`);
    return data.access_token;
}

async function sendGoogleReply(leadResourceName, message) {
    const accessToken = await getAccessToken();
    const resp = await fetch(
        `https://googleads.googleapis.com/v23/customers/${CUSTOMER_ID}/localServices:appendLeadConversation`,
        {
            method: 'POST',
            headers: gadsHeaders(accessToken),
            body: JSON.stringify({
                conversations: [{
                    localServicesLead: leadResourceName,
                    text: message
                }]
            })
        }
    );
    const data = await resp.json();
    if (data.error) throw new Error(`Reply failed: ${data.error.message || JSON.stringify(data.error)}`);
    return data;
}

async function sendAdminDM(text) {
    try {
        const dmResp = await fetch('https://slack.com/api/conversations.open', {
            method: 'POST',
            headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ users: ADMIN_USER_ID })
        });
        const dmData = await dmResp.json();
        if (dmData.ok && dmData.channel) {
            await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel: dmData.channel.id, text, mrkdwn: true })
            });
        }
    } catch(e) { console.error('Admin DM failed:', e); }
}

function normalize(result) {
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.data)) return result.data;
    return [];
}

function getDefaultProfile() {
    return `COMPANY: Hercules Moving Solutions (HMS)
SERVICES: Local and long-distance moving, residential and commercial
SERVICE AREA: Nationwide — we move customers across all 50 states
HOURS: Monday-Sunday, 8 AM - 11 PM EST
WEBSITE: herculesmovingsolutions.com
PHONE: (551) 321-6646

KEY SELLING POINTS:
- Licensed and insured professional movers
- Free detailed moving quotes — no obligation
- Transparent pricing with no hidden fees
- Experienced, careful team that treats your belongings like their own
- Available 7 days a week
- Local, long-distance, and commercial moves

PROCESS:
1. Customer provides moving details (from/to address, approximate date, size of move)
2. We email them a personalized quote within hours
3. Customer reviews and books at their convenience
4. Our team handles everything professionally on moving day

TONE: Friendly, professional, reassuring. We want people to feel like they're in good hands.`;
}
