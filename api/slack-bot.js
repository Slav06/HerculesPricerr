// Johnny Boombotz - AI-Powered Schedule Bot (Claude + Slack)
const { supabaseGet, getSupabaseEnv } = require('./_supabase');

const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ADMIN_USER_ID = 'U08L6LYDJM9'; // Andy — all alerts and approvals go to his DM
const seenEvents = new Set(); // Dedup Slack retries (in-memory, per-instance)

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const body = req.body;

    if (body.type === 'url_verification') {
        return res.status(200).json({ challenge: body.challenge });
    }

    if (body.type === 'event_callback') {
        const event = body.event;
        if (event.bot_id || event.subtype === 'bot_message') return res.status(200).end();

        // Deduplicate Slack retries AND duplicate event types (message + app_mention)
        const eventId = body.event_id;
        const dedupeKey = `${event.user}-${event.channel}-${event.ts}`;
        if ((eventId && seenEvents.has(eventId)) || seenEvents.has(dedupeKey)) return res.status(200).end();
        if (eventId) { seenEvents.add(eventId); setTimeout(() => seenEvents.delete(eventId), 60000); }
        seenEvents.add(dedupeKey); setTimeout(() => seenEvents.delete(dedupeKey), 60000);

        if (event.type === 'message' || event.type === 'app_mention') {
            const text = (event.text || '').replace(/<@[A-Z0-9]+>/gi, '').trim() || 'hi';
            const userId = event.user;
            const channel = event.channel;

            // Process BEFORE responding — Vercel kills functions after res.end()
            try {
                const response = await processWithClaude(text, userId, channel);
                if (response && response.trim().length > 0) await sendSlackMessage(channel, response);
            } catch (e) {
                const errMsg = e?.message || String(e);
                const stackLine = (e?.stack || '').split('\n').find(l => l.includes('slack-bot')) || '';
                console.error('Johnny Boombotz CRASH:', errMsg, e?.stack || '');
                try { await sendSlackMessage(channel, `Sorry, I hit an error: _${errMsg.substring(0, 100)}_\n\`${stackLine.trim()}\``); } catch(_) {}
            }
            return res.status(200).end();
        }
        return res.status(200).end();
    }

    return res.status(200).end();
};

// ─── Claude-Powered Pricing Bot ───

async function processWithClaude(userMessage, userId, channel) {
    // Get the user's Slack display name
    let userName = 'someone';
    try {
        const resp = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
            headers: { Authorization: `Bearer ${BOT_TOKEN}` }
        });
        const info = await resp.json();
        if (info.ok) {
            userName = info.user.profile.display_name || info.user.real_name || info.user.name || 'someone';
        }
    } catch (e) { /* ignore */ }

    // Load pricing matrix from Supabase
    let pricingMatrix = [];
    const matrixResult = await supabaseGet('/rest/v1/pricing_matrix?order=min_miles,min_cubes');
    pricingMatrix = Array.isArray(matrixResult.data) ? matrixResult.data : [];

    const baseRates = pricingMatrix.filter(r => (r.tier_type || 'base') === 'base');
    const mileageAdj = pricingMatrix.filter(r => r.tier_type === 'mileage');
    const regionAdj = pricingMatrix.filter(r => r.tier_type === 'region');

    const pricingTable = baseRates.length > 0
        ? 'BASE RATES (at 1000 miles):\n' + baseRates.map(r =>
            `- ${r.label || ''}: ${r.min_cubes}-${r.max_cubes} CF → $${Number(r.per_cf_rate).toFixed(2)}/CF`
        ).join('\n')
        + (mileageAdj.length ? '\n\nMILEAGE ADJUSTMENTS:\n' + mileageAdj.map(r => {
            const adjType = r.region_applies_to || 'flat';
            if (adjType === 'percent') return `- ${r.min_miles}-${r.max_miles} miles: ${r.fuel_surcharge_pct >= 0 ? '+' : ''}${r.fuel_surcharge_pct}% of base`;
            if (adjType === 'per_mile') return `- ${r.min_miles}-${r.max_miles} miles: $${r.per_cf_rate}/mile difference from 1000`;
            return `- ${r.min_miles}-${r.max_miles} miles: ${r.per_cf_rate >= 0 ? '+' : ''}$${r.per_cf_rate} flat (${r.label || ''})`;
        }).join('\n') : '')
        + (regionAdj.length ? '\n\nREGIONAL ADJUSTMENTS:\n' + regionAdj.map(r => {
            const isPercent = r.fuel_surcharge_pct !== 0;
            const amt = isPercent ? `${r.fuel_surcharge_pct >= 0 ? '+' : ''}${r.fuel_surcharge_pct}%` : `${r.per_cf_rate >= 0 ? '+' : ''}$${r.per_cf_rate}`;
            return `- ${r.label}: ${amt}/CF (applies to ${r.region_adj_applies || 'either'} end of move)`;
        }).join('\n') : '')
        : 'No pricing matrix found in database.';

    // Fetch recent channel messages for context
    let recentMessages = '';
    try {
        const histResp = await fetch(`https://slack.com/api/conversations.history?channel=${channel}&limit=10`, {
            headers: { Authorization: `Bearer ${BOT_TOKEN}` }
        });
        const histData = await histResp.json();
        if (histData.ok && histData.messages) {
            recentMessages = histData.messages.slice().reverse().map(m => {
                const who = m.bot_id ? 'Johnny Boombotz' : (m.user || '?');
                const txt = (m.text || '').replace(/<@([A-Z0-9]+)>/gi, '@user');
                return `[${who}] ${txt}`;
            }).join('\n');
        }
    } catch (e) { /* ignore */ }

    const systemPrompt = `You are Johnny Boombotz, the pricing bot for Perfectly Fast Moving. You help reps quickly price out moving jobs on Slack.

PERSON MESSAGING YOU: ${userName}

YOUR JOB:
When someone gives you a move-from zip code, move-to zip code, and cubic feet (CF), calculate the job price using the pricing matrix below.

PRICING MATRIX:
${pricingTable}

HOW TO PRICE A JOB:
1. Estimate distance between the two zip codes using your knowledge of US geography.
2. Find the matching BASE RATE tier based on volume (CF). The rate is $/CF (dollars per cubic foot).
3. Apply MILEAGE ADJUSTMENT — this ADDS or SUBTRACTS from the per-CF rate (e.g. base $4.50/CF + $0.25 mileage adj = $4.75/CF).
4. Apply REGIONAL ADJUSTMENT — also adds/subtracts per CF if origin or destination zip matches.
5. Calculate: Total = CF x final adjusted rate/CF

RESPONSE FORMAT for pricing:
*Job:* #[job number]
*Move:* [from zip] → [to zip]
*Distance:* ~[X] miles
*Volume:* [X] CF
*Base rate:* $[X.XX]/CF ([tier label])
*Mileage adj:* +$[X.XX]/CF → $[X.XX]/CF
*Regional adj:* +$[X.XX]/CF → $[X.XX]/CF _(only if applicable)_
*Final rate:* *$[X.XX]/CF*

Do NOT show a total dollar amount. Only show the final per-CF rate. Never multiply rate x cubes. The rep just needs the rate.

After giving the rate, add this action tag so we can log it:
<!--PRICE_LOG:JOB_NUMBER:FROM_ZIP:TO_ZIP:CUBES:FINAL_RATE:REP_NAME-->

JOB NUMBER REQUIREMENT:
- A job number looks like 6134545 or 7134545 (7 digits).
- If the rep provides a job number WITH their pricing request, use it and give the rate immediately.
- If the rep does NOT provide a job number, DO NOT give them the rate. Instead, roast them with dark humor. Make fun of them for forgetting the job number. Be savage, creative, and funny. Think along the lines of: questioning their competence, comparing them to something hilariously incompetent, dark sarcasm about their future in sales, etc. Keep it workplace-appropriate but sharp and brutal.
- CRITICAL: Never repeat the same joke. Every roast must be original and different from the last. Be creative. Pull from different angles each time — their memory, their career choices, their attention to detail, their reading comprehension, etc.
- After roasting them, tell them to try again WITH the job number.
- Once they provide the job number in a follow-up message along with the pricing details, give them the rate and log it.

RULES:
- Keep responses SHORT. This is Slack, not email.
- Be direct and confident with pricing. Don't hedge.
- NEVER give a rate without a job number. Roast first, rate after.
- If someone gives partial info (like just zip codes, no cubes), ask for the missing piece.
- NEVER show a total dollar amount. Only the final $/CF rate.
- Use Slack markdown: *bold* for the final rate.
- If someone asks something unrelated to pricing, be friendly but brief.
- You can also answer general questions about pricing tiers if asked.
- If zip codes are clearly in the same metro area, use 0-50 miles as estimate.
- For cross-country moves (e.g., FL to NY), estimate 1,000+ miles.
- Use your knowledge of US geography to estimate distances between zip codes.

${recentMessages ? `RECENT MESSAGES:\n${recentMessages}` : ''}`;

    // Call Claude
    let claudeData = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': ANTHROPIC_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 500,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }]
            })
        });
        if (claudeResp.status === 429) {
            const wait = Math.min(parseInt(claudeResp.headers.get('retry-after') || '5', 10), 10) * 1000;
            if (attempt < 2) { await new Promise(r => setTimeout(r, wait)); continue; }
            return 'I\'m a bit busy right now. Try again in a minute.';
        }
        claudeData = await claudeResp.json();
        if (!claudeResp.ok) {
            const errDetail = claudeData?.error?.message || JSON.stringify(claudeData).substring(0, 200);
            console.error('Claude API error:', claudeResp.status, errDetail);
            return `Claude API error (${claudeResp.status}): _${errDetail}_`;
        }
        break;
    }

    let response = claudeData?.content?.[0]?.text || "Sorry, I couldn't process that. Try again?";

    // Process PRICE_LOG actions
    const priceLogMatches = [...response.matchAll(/<!--PRICE_LOG:(.+?):(.+?):(.+?):(.+?):(.+?):(.+?)-->/g)];
    for (const match of priceLogMatches) {
        const [, jobNumber, fromZip, toZip, cubes, finalRate, repName] = match;
        try {
            const env = getSupabaseEnv();
            if (env.url && env.anonKey) {
                await fetch(env.url + '/rest/v1/price_quotes', {
                    method: 'POST',
                    headers: {
                        apikey: env.anonKey,
                        Authorization: `Bearer ${env.anonKey}`,
                        'Content-Type': 'application/json',
                        Prefer: 'return=minimal',
                    },
                    body: JSON.stringify({
                        job_number: jobNumber,
                        from_zip: fromZip,
                        to_zip: toZip,
                        cubes: parseInt(cubes) || 0,
                        final_rate: parseFloat(finalRate) || 0,
                        rep_name: repName,
                        quoted_at: new Date().toISOString(),
                        status: 'quoted',
                    }),
                });
            }
        } catch (e) {
            console.error('Failed to log price quote:', e);
        }
        response = response.replace(match[0], '');
    }

    return response.trim();
}

// ─── Helpers ───

async function sendSlackMessage(channel, text) {
    try {
        await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel, text, mrkdwn: true })
        });
    } catch (e) {
        console.error('Failed to send Slack message:', e);
    }
}
