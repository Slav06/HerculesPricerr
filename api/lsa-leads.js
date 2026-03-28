// LSA Leads & Conversations API - Fetches Google Local Services Ads leads
const { supabaseGet, supabasePost, getSupabaseEnv } = require('./_supabase');
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;
const MANAGER_ID = process.env.GOOGLE_ADS_MANAGER_ID;

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const action = req.query.action || 'leads';
        let accessToken;
        try {
            accessToken = await getAccessToken();
        } catch (e) {
            return res.status(500).json({ error: 'OAuth failed: ' + e.message, debug: 'Could not get access token' });
        }

        if (action === 'leads') {
            const leads = await fetchLeads(accessToken);
            return res.json(leads);
        }

        if (action === 'debug') {
            // Test the connection
            const leads = await fetchLeads(accessToken);
            return res.json({ token_ok: true, customer_id: CUSTOMER_ID, leads });
        }

        if (action === 'conversations') {
            const leadId = req.query.lead_id;
            if (!leadId) return res.status(400).json({ error: 'lead_id required' });
            const convos = await fetchConversations(accessToken, leadId);

            // Merge in our stored reply texts
            const repliesResult = await supabaseGet(`/rest/v1/lsa_replies?lead_id=eq.${leadId}&order=replied_at`);
            const replies = Array.isArray(repliesResult.data) ? repliesResult.data : (Array.isArray(repliesResult) ? repliesResult : []);

            // Attach stored reply text to matching advertiser events by timestamp proximity
            if (replies.length && convos.messages) {
                const advertiserMsgs = convos.messages.filter(m => (m.participant || '').toUpperCase() === 'ADVERTISER');
                replies.forEach((r, i) => {
                    if (advertiserMsgs[i]) {
                        advertiserMsgs[i].text = r.bot_reply;
                    }
                });
            }

            return res.json(convos);
        }

        if (action === 'reply') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
            const { lead_id, message } = req.body;
            if (!lead_id || !message) return res.status(400).json({ error: 'lead_id and message required' });
            const result = await sendReply(accessToken, lead_id, message);

            // Store our reply so we can show it later
            const leadIdNum = lead_id.includes('/') ? lead_id.split('/').pop() : lead_id;
            await supabasePost('/rest/v1/lsa_replies', {
                lead_id: leadIdNum,
                lead_resource: lead_id,
                bot_reply: message,
                replied_at: new Date().toISOString()
            });

            return res.json(result);
        }

        return res.status(400).json({ error: 'Unknown action. Use: leads, conversations, reply' });
    } catch (err) {
        console.error('LSA API error:', err);
        return res.status(500).json({ error: err.message });
    }
};

// Get fresh access token from refresh token
async function getAccessToken() {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: REFRESH_TOKEN,
            grant_type: 'refresh_token'
        })
    });
    const data = await resp.json();
    if (data.error) throw new Error(`OAuth error: ${data.error} - ${data.error_description}`);
    return data.access_token;
}

// Google Ads API helper
function gadsHeaders(accessToken) {
    return {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': DEVELOPER_TOKEN,
        'login-customer-id': MANAGER_ID,
        'Content-Type': 'application/json'
    };
}

// Fetch LSA leads via Google Ads API
async function fetchLeads(accessToken) {
    const query = `
        SELECT
            local_services_lead.id,
            local_services_lead.resource_name,
            local_services_lead.lead_type,
            local_services_lead.contact_details,
            local_services_lead.lead_status,
            local_services_lead.creation_date_time
        FROM local_services_lead
        ORDER BY local_services_lead.creation_date_time DESC
        LIMIT 50
    `;

    const resp = await fetch(
        `https://googleads.googleapis.com/v23/customers/${CUSTOMER_ID}/googleAds:search`,
        {
            method: 'POST',
            headers: gadsHeaders(accessToken),
            body: JSON.stringify({ query })
        }
    );

    const rawText = await resp.text();
    let data;
    try { data = JSON.parse(rawText); } catch(e) { return { leads: [], error: 'Invalid JSON response', raw: rawText.substring(0, 500) }; }

    if (data.error) {
        return { leads: [], error: `Google Ads API: ${data.error.message || data.error.status}`, details: data.error.details, raw: data.error };
    }

    // Parse results — handle both searchStream (array) and search (object) responses
    const leads = [];
    const results = Array.isArray(data) ? (data[0]?.results || []) : (data.results || []);
    for (const result of results) {
        const lead = result.localServicesLead;
        if (lead) {
            leads.push({
                id: lead.id,
                resourceName: lead.resourceName,
                type: lead.leadType,
                status: lead.leadStatus,
                phone: lead.contactDetails?.phoneNumber,
                email: lead.contactDetails?.email,
                name: lead.contactDetails?.consumerName,
                createdAt: lead.creationDateTime
            });
        }
    }

    return { leads, count: leads.length };
}

// Fetch conversations for a specific lead
async function fetchConversations(accessToken, leadId) {
    // leadId can be resource name or just the ID
    const resourceName = leadId.includes('/') ? leadId : `customers/${CUSTOMER_ID}/localServicesLeads/${leadId}`;

    const query = `
        SELECT
            local_services_lead_conversation.id,
            local_services_lead_conversation.conversation_channel,
            local_services_lead_conversation.participant_type,
            local_services_lead_conversation.event_date_time
        FROM local_services_lead_conversation
        WHERE local_services_lead_conversation.lead = '${resourceName}'
        ORDER BY local_services_lead_conversation.event_date_time ASC
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
    if (data.error) throw new Error(`Google Ads API: ${data.error.message || JSON.stringify(data.error)}`);

    const messages = [];
    const results = Array.isArray(data) ? (data[0]?.results || []) : (data.results || []);
    for (const result of results) {
        const convo = result.localServicesLeadConversation;
        if (convo) {
            messages.push({
                id: convo.id,
                channel: convo.conversationChannel,
                participant: convo.participantType,
                text: null, // Google Ads API doesn't expose message text via GAQL
                time: convo.eventDateTime
            });
        }
    }

    return { leadId, messages };
}

// Send reply to a lead conversation
async function sendReply(accessToken, leadId, message) {
    const resourceName = leadId.includes('/') ? leadId : `customers/${CUSTOMER_ID}/localServicesLeads/${leadId}`;

    const resp = await fetch(
        `https://googleads.googleapis.com/v23/customers/${CUSTOMER_ID}/localServices:appendLeadConversation`,
        {
            method: 'POST',
            headers: gadsHeaders(accessToken),
            body: JSON.stringify({
                conversations: [{
                    localServicesLead: resourceName,
                    text: message
                }]
            })
        }
    );

    const data = await resp.json();
    if (data.error) throw new Error(`Reply failed: ${data.error.message || JSON.stringify(data.error)}`);
    return { success: true, data };
}
