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

// ─── Claude-Powered Message Processing ───

async function processWithClaude(userMessage, userId, channel) {
    // Get employee info
    const userName = await getSlackUserName(userId);
    const today = fmtDate(new Date());
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = fmtDate(tomorrow);
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    // Get this employee's upcoming schedule
    let mySchedule = [];
    if (userName) {
        const endDate = new Date(); endDate.setDate(endDate.getDate() + 14);
        const result = await supabaseGet(`/rest/v1/schedule_entries?employee_name=eq.${encodeURIComponent(userName)}&schedule_date=gte.${today}&schedule_date=lte.${fmtDate(endDate)}&order=schedule_date`);
        mySchedule = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
    }

    // Get today's/tomorrow's full crew
    const todayCrew = await supabaseGet(`/rest/v1/schedule_entries?schedule_date=eq.${today}&order=shift_start`);
    const tomorrowCrew = await supabaseGet(`/rest/v1/schedule_entries?schedule_date=eq.${tomorrowStr}&order=shift_start`);
    const todayEntries = Array.isArray(todayCrew.data) ? todayCrew.data : (Array.isArray(todayCrew) ? todayCrew : []);
    const tomorrowEntries = Array.isArray(tomorrowCrew.data) ? tomorrowCrew.data : (Array.isArray(tomorrowCrew) ? tomorrowCrew : []);

    // Get all employees
    const empResult = await supabaseGet('/rest/v1/employees?is_active=eq.true&order=name');
    const employees = Array.isArray(empResult.data) ? empResult.data : (Array.isArray(empResult) ? empResult : []);

    // Get pending hour confirmations for this employee
    let pendingHours = [];
    if (userName) {
        const confirmResult = await supabaseGet(`/rest/v1/payroll_confirmations?employee_name=eq.${encodeURIComponent(userName)}&status=eq.pending&order=week_start.desc`);
        pendingHours = Array.isArray(confirmResult.data) ? confirmResult.data : (Array.isArray(confirmResult) ? confirmResult : []);
    }

    // Fetch recent channel messages so Johnny Boombotz has context
    let recentMessages = '';
    try {
        const histResp = await fetch(`https://slack.com/api/conversations.history?channel=${channel}&limit=15`, {
            headers: { Authorization: `Bearer ${BOT_TOKEN}` }
        });
        const histData = await histResp.json();
        if (histData.ok && histData.messages) {
            const slackNames = {};
            for (const emp of employees) {
                if (emp.slack_user_id) slackNames[emp.slack_user_id] = emp.name;
            }
            recentMessages = histData.messages.slice().reverse().map(m => {
                const who = slackNames[m.user] || (m.bot_id ? 'Johnny Boombotz' : m.user || '?');
                const txt = (m.text || '').replace(/<@([A-Z0-9]+)>/gi, (_, id) => '@' + (slackNames[id] || id));
                return `[${who}] ${txt}`;
            }).join('\n');
        }
    } catch (e) { console.warn('Failed to fetch channel history:', e.message); }

    const systemPrompt = `You are Johnny Boombotz, the friendly and professional schedule manager bot for Hercules Moving Solutions (HMS), a moving company. You communicate on Slack.

CURRENT DATE: ${today} (${dayOfWeek})
EMPLOYEE MESSAGING YOU: ${userName || 'Unknown (no Slack ID linked)'}

${pendingHours.length > 0 ? `⚠️ PENDING HOURS CONFIRMATIONS:
${pendingHours.map(p => `- Week of ${p.week_start}: UNCONFIRMED (hours won't be paid until confirmed)`).join('\n')}
If the employee says "confirmed", "yes my hours are correct", "approve my hours", or anything indicating they confirm their hours, use <!--ACTION:CONFIRM_HOURS:${pendingHours[0].week_start}--> to mark them confirmed.` : ''}

TEAM MEMBERS: ${employees.map(e => e.name).join(', ')}

${userName ? `${userName.toUpperCase()}'S UPCOMING SHIFTS:
${mySchedule.length ? mySchedule.map(s => {
    const d = new Date(s.schedule_date + 'T12:00:00');
    const day = d.toLocaleDateString('en-US', {weekday: 'long', month: 'short', day: 'numeric'});
    return `- ${s.schedule_date} (${day}): ${fmtTime(s.shift_start)} to ${fmtTime(s.shift_end)} [status: ${s.status}]`;
}).join('\n') : 'No upcoming shifts'}` : ''}

TODAY'S CREW (${today}):
${todayEntries.length ? todayEntries.map(e => `- ${e.employee_name}: ${fmtTime(e.shift_start)}-${fmtTime(e.shift_end)} [${e.status}]`).join('\n') : 'Nobody scheduled'}

TOMORROW'S CREW (${tomorrowStr}):
${tomorrowEntries.length ? tomorrowEntries.map(e => `- ${e.employee_name}: ${fmtTime(e.shift_start)}-${fmtTime(e.shift_end)} [${e.status}]`).join('\n') : 'Nobody scheduled'}

YOUR CAPABILITIES - Include ACTION blocks in your response to take actions. Use the YYYY-MM-DD date from the shift list above.

1. CONFIRM a shift: <!--ACTION:CONFIRM:YYYY-MM-DD-->
2. CALLOUT (employee can't make it): <!--ACTION:CALLOUT:YYYY-MM-DD:reason-->
3. UPDATE shift hours: <!--ACTION:UPDATE:YYYY-MM-DD:HH:MM:HH:MM--> (new start:end in 24h)
4. ALERT admin channel: <!--ACTION:ALERT:message-->
5. CONFIRM HOURS for payroll: <!--ACTION:CONFIRM_HOURS:YYYY-MM-DD--> (week_start date, confirms their weekly hours for payment)
6. RESET SECRET KEY: <!--ACTION:RESET_KEY--> (generates a new login key for the employee and DMs it to them)
7. SET REMINDER for a team member: <!--ACTION:REMINDER:TARGET_NAMES:DATE:TIME:MESSAGE--> (remind someone to do something, e.g. call back a customer)
8. REQUEST MANUAL HOURS: <!--ACTION:MANUAL_HOURS:HOURS:MINUTES:DATE:REASON--> (submits a PENDING request — MUST be approved by management before hours are added. Tell the employee their request has been SUBMITTED FOR APPROVAL, never say "added" or "done")
9. TRACK KEYWORD: <!--ACTION:TRACK:keyword:intel_text--> (teach Johnny Boombotz to watch for a keyword in conversations)
10. STOP TRACKING: <!--ACTION:STOP_TRACK:keyword--> (stop tracking a keyword)
11. LIST RULES: <!--ACTION:LIST_RULES--> (show current custom tracking rules)
12. DM UNCONFIRMED EMPLOYEES: <!--ACTION:DM_UNCONFIRMED:YYYY-MM-DD:YYYY-MM-DD:optional warning message--> (DM all employees who haven't confirmed their shifts for the given date range)

DM UNCONFIRMED EXAMPLES:
- "remind everyone who didn't confirm" → <!--ACTION:DM_UNCONFIRMED:${today}:${tomorrowStr}:Please confirm your shift ASAP or you may be docked.-->
- "message unconfirmed employees for this week" → use today through end of week dates
- You CAN and SHOULD send DMs to employees when asked. You have full ability to message anyone on the team.
- When Andy or an admin asks you to remind/message/DM employees about confirmations, DO IT immediately using DM_UNCONFIRMED. Never say you can't.

REMINDER EXAMPLES:
- "remind Aubrey and Andrew to call back Lena A2328088 at 9am" → <!--ACTION:REMINDER:Aubrey,Andrew:${tomorrowStr}:09:00:Call back Lena Milgrom A2328088-->
- "remind morning shift to follow up with customer" → <!--ACTION:REMINDER:morning_shift:${tomorrowStr}:09:00:Follow up with customer-->
- Use the morning crew names from tomorrow's schedule when "morning shift" is mentioned.

MANUAL HOURS EXAMPLES:
- "add 2 hours for today" → <!--ACTION:MANUAL_HOURS:2:0:${today}:add 2 hours for today-->
- "log 1h 30m for yesterday" → <!--ACTION:MANUAL_HOURS:1:30:${fmtDate(new Date(Date.now() - 86400000))}:log 1h 30m for yesterday-->
- "I worked 3 hours off the clock" → <!--ACTION:MANUAL_HOURS:3:0:${today}:worked 3 hours off the clock-->
Use today's date (the CURRENT DATE above) if no date specified, yesterday's date if they say "yesterday".
CRITICAL: Manual hours are NOT added immediately. They go to management for approval. ALWAYS tell the employee: "I've submitted your request for X hours to management for approval." NEVER say "added" or "done". Employees CANNOT confirm their own manual hours requests.

RULES:
- Keep responses SHORT. 1-3 sentences max. This is Slack, not email.
- No emojis except occasionally. Never use :wave: or :blush: or similar.
- Be direct and professional, not bubbly. Johnny Boombotz is sharp, not a cheerful assistant.
- When someone says they can/can't work, take the appropriate action immediately.
- When someone gives you new hours (like "I can do 3pm to 12am"), UPDATE their shift and confirm.
- When someone calls out, mark their shift as CALLOUT and ALERT the admin channel.
- When someone confirms, CONFIRM their next unconfirmed shift.
- If someone asks about the schedule, answer from the data above.
- If you don't know who's messaging (no name), ask them to have an admin link their Slack ID.
- Use Slack markdown: *bold*, _italic_, \`code\`.
- Convert times to 12-hour format for display but use 24-hour in ACTION blocks.
- ALWAYS use the exact YYYY-MM-DD date string from the shift list in action blocks. NEVER use shift IDs.
- CRITICAL: NEVER mention, confirm, or discuss pay rates, hourly rates, commission percentages, or dollar amounts with ANY employee. If asked about pay, say "Please talk to management about pay details." Only mention hours, never money.
- If someone asks to reset their key, forgot their password, can't log in, needs a new key, or anything about login issues — use <!--ACTION:RESET_KEY--> and tell them you're generating a new key.
- When someone asks you to remind someone to call back a customer or follow up on a lead, use the REMINDER action. Don't ask clarifying questions — just do it with the info you have.
- When someone asks to add/log manual hours or says they worked off the clock, use MANUAL_HOURS action. Extract hours, minutes, and date. Default to today if no date given.
- When someone says "track [keyword]" or "when you see [X], note [Y]", use TRACK action.
- When someone says "stop tracking [keyword]", use STOP_TRACK action.
- When someone says "show rules" or "what do you track", use LIST_RULES action.
- When an admin asks you to remind/message/DM unconfirmed employees, use DM_UNCONFIRMED immediately. You CAN send DMs. Never say you can't. Never ask for clarification — just do it.
- IMPORTANT: When someone says "do it", "yes", "go ahead", "send it", or similar confirmations after you listed information, TAKE THE ACTION. Don't ask again.

DO NOT RESPOND TO THESE — IGNORE COMPLETELY:
- Messages about lead status, pricing, deals, objections, booking, deposits, cubes, miles, quotes, OTP, transfers, dropped leads, or sales tactics.
- Messages that mention job numbers (like A2328088) WITHOUT asking you to do something (remind, call back, follow up).
- General sales floor chatter between reps.
- If the message is purely about sales/deals and not asking you for an action, DO NOT REPLY AT ALL. Return an empty string.
- Only respond when someone is directly asking YOU to do something (remind, confirm shift, call out, schedule question, etc.)

CRITICAL DATE MATCHING:
- Today is ${dayOfWeek}, ${today}.
- When someone says a day name like "sunday", match it to the EXACT date in their shift list above.
- If today IS that day, use today's date.
- If no shift exists for that day, tell them.

${recentMessages ? `RECENT CHANNEL MESSAGES (newest last):
${recentMessages}

Use this context to understand what people are referring to. If someone says "respond to Adrian" or "what did X say", you can see it above. If someone asks to add hours, handle their request using the MANUAL_HOURS action even if they asked in a previous message.` : ''}`;

    // Call Claude with rate-limit retry
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
            console.warn('Johnny Boombotz rate limited, attempt', attempt + 1, '— waiting', wait, 'ms');
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
    let response = claudeData?.content?.[0]?.text || '';
    if (!response) {
        console.error('Claude returned no text. Full response:', JSON.stringify(claudeData));
        response = "Sorry, I couldn't process that. Try again?";
    }

    // Execute any actions Johnny Boombotz decided to take
    response = await executeActions(response, userName);

    return response;
}

// ─── Execute Actions from Claude's Response ───

async function executeActions(response, userName) {
    if (!response || typeof response !== 'string') return response || '';
    if (!userName) return response.replace(/<!--ACTION:.+?-->/g, '').trim();

    const encodedName = encodeURIComponent(userName);

    // CONFIRM action — date-based
    const confirmMatches = [...response.matchAll(/<!--ACTION:CONFIRM:(\d{4}-\d{2}-\d{2})-->/g)];
    for (const match of confirmMatches) {
        const date = match[1];
        await sbPatch(`/rest/v1/schedule_entries?employee_name=eq.${encodedName}&schedule_date=eq.${date}`, {
            status: 'confirmed', confirmed_at: new Date().toISOString()
        });
        response = response.replace(match[0], '');
    }

    // CALLOUT action — date-based
    const calloutMatches = [...response.matchAll(/<!--ACTION:CALLOUT:(\d{4}-\d{2}-\d{2}):(.+?)-->/g)];
    for (const match of calloutMatches) {
        const date = match[1];
        const reason = match[2];
        await sbPatch(`/rest/v1/schedule_entries?employee_name=eq.${encodedName}&schedule_date=eq.${date}`, {
            status: 'callout', callout_reason: reason, updated_at: new Date().toISOString()
        });
        response = response.replace(match[0], '');
    }

    // UPDATE action — date-based
    const updateMatches = [...response.matchAll(/<!--ACTION:UPDATE:(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2}):(\d{2}:\d{2})-->/g)];
    for (const match of updateMatches) {
        const date = match[1];
        const newStart = match[2];
        const newEnd = match[3];
        await sbPatch(`/rest/v1/schedule_entries?employee_name=eq.${encodedName}&schedule_date=eq.${date}`, {
            shift_start: newStart, shift_end: newEnd, status: 'confirmed',
            callout_reason: null, confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString()
        });
        response = response.replace(match[0], '');
    }

    // CONFIRM_HOURS action — payroll confirmation
    const hoursMatches = [...response.matchAll(/<!--ACTION:CONFIRM_HOURS:(\d{4}-\d{2}-\d{2})-->/g)];
    for (const match of hoursMatches) {
        const weekStart = match[1];
        await sbPatch(`/rest/v1/payroll_confirmations?employee_name=eq.${encodedName}&week_start=eq.${weekStart}`, {
            status: 'confirmed', confirmed_at: new Date().toISOString()
        });
        response = response.replace(match[0], '');
    }

    // RESET_KEY action
    const resetMatches = [...response.matchAll(/<!--ACTION:RESET_KEY-->/g)];
    for (const match of resetMatches) {
        if (userName) {
            const newKey = generateKey();
            // Find their dashboard_name
            const empResult = await supabaseGet(`/rest/v1/employees?name=eq.${encodedName}&select=dashboard_name`);
            const empData = Array.isArray(empResult.data) ? empResult.data : (Array.isArray(empResult) ? empResult : []);
            const dashName = empData[0]?.dashboard_name || userName;

            // Update the secret key
            const env = getSupabaseEnv();
            await fetch(`${env.url}/rest/v1/dashboard_users?name=ilike.${encodeURIComponent(dashName)}`, {
                method: 'PATCH',
                headers: { apikey: env.anonKey, Authorization: `Bearer ${env.anonKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
                body: JSON.stringify({ secretkey: newKey })
            });

            // Replace the action tag with the new key info
            response = response.replace(match[0], '');
            response += `\n\nYour new login details:\n*Name:* \`${dashName}\`\n*New Key:* \`${newKey}\`\n\nUse these at: app.herculesmovingsolutions.com/confirm-commission`;
        } else {
            response = response.replace(match[0], '');
        }
    }

    // REMINDER action
    const reminderMatches = [...response.matchAll(/<!--ACTION:REMINDER:(.+?):(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2}):(.+?)-->/g)];
    for (const match of reminderMatches) {
        const targets = match[1];
        const date = match[2];
        const time = match[3];
        const message = match[4];
        try {
            const env = getSupabaseEnv();
            await fetch(env.url + '/rest/v1/sandy_reminders', {
                method: 'POST',
                headers: {
                    apikey: env.anonKey,
                    Authorization: `Bearer ${env.anonKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=minimal',
                },
                body: JSON.stringify({
                    targets: targets.replace(/,/g, ', '),
                    reminder_text: message + (userName ? ` (requested by ${userName})` : ''),
                    reminder_date: date,
                    reminder_time: time,
                    job_number: (message.match(/[AS]\d{7}/i) || [null])[0],
                    customer_name: null,
                    status: 'pending',
                    created_by: userName || 'unknown',
                }),
            });
        } catch (e) {
            console.error('Failed to save reminder:', e);
        }
        response = response.replace(match[0], '');
    }

    // MANUAL_HOURS action
    const manualHoursMatches = [...response.matchAll(/<!--ACTION:MANUAL_HOURS:(\d+):(\d+):(\d{4}-\d{2}-\d{2}):(.+?)-->/g)];
    for (const match of manualHoursMatches) {
        const hours = parseInt(match[1]);
        const mins = parseInt(match[2]);
        const date = match[3];
        const reason = match[4];
        const totalMinutes = hours * 60 + mins;

        try {
            const env = getSupabaseEnv();
            // Look up employee
            const empResult = await supabaseGet(`/rest/v1/employees?name=ilike.%25${encodeURIComponent(userName)}%25&is_active=eq.true&limit=1`);
            const employee = (empResult.data && empResult.data.length > 0) ? empResult.data[0] : null;

            if (employee && employee.worksnap_id) {
                const hourlyRate = employee.hourly_rate || 0;
                const estimatedPay = ((totalMinutes / 60) * hourlyRate).toFixed(2);

                // Create pending request
                const insertResult = await fetch(env.url + '/rest/v1/manual_hours_requests', {
                    method: 'POST',
                    headers: {
                        apikey: env.anonKey,
                        Authorization: `Bearer ${env.anonKey}`,
                        'Content-Type': 'application/json',
                        Prefer: 'return=representation',
                    },
                    body: JSON.stringify({
                        employee_name: employee.name,
                        worksnap_id: employee.worksnap_id,
                        date: date,
                        duration_minutes: totalMinutes,
                        reason: reason,
                        requested_via: 'slack',
                        status: 'pending',
                    }),
                });
                const insertData = await insertResult.json().catch(() => null);
                const requestId = (Array.isArray(insertData) && insertData[0]) ? insertData[0].id : 'N/A';

                // DM Andy for approval
                const ANDY_SLACK_ID = 'U08L6LYDJM9';
                const baseUrl = 'https://www.herculesmovingsolutions.com';
                const approveUrl = `${baseUrl}/api/manual-hours?action=approve&request_id=${requestId}&approved_by=Andy`;
                const rejectUrl = `${baseUrl}/api/manual-hours?action=reject&request_id=${requestId}&rejected_by=Andy`;

                const dmResp = await fetch('https://slack.com/api/conversations.open', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ users: ANDY_SLACK_ID })
                });
                const dmData = await dmResp.json();
                if (dmData.ok && dmData.channel) {
                    const approvalMsg = `:clock3: *Manual Hours Request*\n\n*Employee:* ${employee.name}\n*Date:* ${date}\n*Hours:* ${hours}h ${mins}m (${totalMinutes} minutes)\n*Estimated Pay:* $${estimatedPay} (at $${hourlyRate}/hr)\n*Reason:* ${reason}\n\n<${approveUrl}|:white_check_mark: Approve>    <${rejectUrl}|:x: Reject>`;
                    await sendSlackMessage(dmData.channel.id, approvalMsg);
                }
            }
        } catch (e) {
            console.error('Failed to process manual hours:', e);
        }
        response = response.replace(match[0], '');
    }

    // TRACK action
    const trackMatches = [...response.matchAll(/<!--ACTION:TRACK:(.+?):(.+?)-->/g)];
    for (const match of trackMatches) {
        const keyword = match[1];
        const intelText = match[2];
        try {
            const env = getSupabaseEnv();
            await fetch(env.url + '/rest/v1/sandy_custom_rules', {
                method: 'POST',
                headers: {
                    apikey: env.anonKey,
                    Authorization: `Bearer ${env.anonKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=minimal',
                },
                body: JSON.stringify({
                    rule_type: 'track_keyword',
                    keyword: keyword,
                    action: 'note',
                    intel_text: intelText,
                    created_by: userName || 'unknown',
                    active: true,
                }),
            });
        } catch (e) {
            console.error('Failed to save tracking rule:', e);
        }
        response = response.replace(match[0], '');
    }

    // STOP_TRACK action
    const stopTrackMatches = [...response.matchAll(/<!--ACTION:STOP_TRACK:(.+?)-->/g)];
    for (const match of stopTrackMatches) {
        const keyword = match[1];
        try {
            const env = getSupabaseEnv();
            await fetch(env.url + `/rest/v1/sandy_custom_rules?keyword=ilike.%25${encodeURIComponent(keyword)}%25&active=eq.true`, {
                method: 'PATCH',
                headers: {
                    apikey: env.anonKey,
                    Authorization: `Bearer ${env.anonKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ active: false }),
            });
        } catch (e) {
            console.error('Failed to stop tracking:', e);
        }
        response = response.replace(match[0], '');
    }

    // LIST_RULES action
    const listRulesMatches = [...response.matchAll(/<!--ACTION:LIST_RULES-->/g)];
    for (const match of listRulesMatches) {
        try {
            const rulesResult = await supabaseGet('/rest/v1/sandy_custom_rules?active=eq.true&select=keyword,intel_text,created_by&order=created_at.desc');
            const rules = Array.isArray(rulesResult.data) ? rulesResult.data : [];
            if (rules.length > 0) {
                const rulesList = rules.map((r, i) => `${i+1}. *${r.keyword}* → ${r.intel_text} _(by ${r.created_by})_`).join('\n');
                response = response.replace(match[0], `\n\nMy custom rules (${rules.length}):\n${rulesList}`);
            } else {
                response = response.replace(match[0], '');
            }
        } catch (e) {
            response = response.replace(match[0], '');
        }
    }

    // DM_UNCONFIRMED action — DM all unconfirmed employees for a date range
    const dmUnconfirmedMatches = [...response.matchAll(/<!--ACTION:DM_UNCONFIRMED:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2}):(.+?)-->/g)];
    for (const match of dmUnconfirmedMatches) {
        const fromDate = match[1];
        const toDate = match[2];
        const warningMsg = match[3] || 'Please confirm your shift.';

        try {
            // Get all unconfirmed schedule entries in the date range
            const schedResult = await supabaseGet(
                `/rest/v1/schedule_entries?schedule_date=gte.${fromDate}&schedule_date=lte.${toDate}&status=neq.confirmed&status=neq.callout&select=employee_name,schedule_date,shift_start,shift_end,status&order=schedule_date`
            );
            const entries = Array.isArray(schedResult.data) ? schedResult.data : [];

            // Group by employee
            const byEmployee = {};
            for (const e of entries) {
                if (!byEmployee[e.employee_name]) byEmployee[e.employee_name] = [];
                byEmployee[e.employee_name].push(e);
            }

            // Get employee slack IDs
            const empResult = await supabaseGet('/rest/v1/employees?is_active=eq.true&select=name,slack_user_id');
            const empData = Array.isArray(empResult.data) ? empResult.data : [];
            const slackIdMap = {};
            for (const emp of empData) {
                if (emp.slack_user_id) slackIdMap[emp.name] = emp.slack_user_id;
            }

            // DM each unconfirmed employee
            let dmsSent = 0;
            const failedNames = [];
            for (const [name, shifts] of Object.entries(byEmployee)) {
                const slackId = slackIdMap[name];
                if (!slackId) {
                    failedNames.push(name);
                    continue;
                }

                const shiftList = shifts.map(s => {
                    const d = new Date(s.schedule_date + 'T12:00:00');
                    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    return `• ${dayLabel}: ${fmtTime(s.shift_start)} - ${fmtTime(s.shift_end)}`;
                }).join('\n');

                const dmText = `Hey ${name}, you have unconfirmed shifts:\n\n${shiftList}\n\n${warningMsg}\n\nReply *confirm* to confirm your shifts.`;

                try {
                    const dmOpen = await fetch('https://slack.com/api/conversations.open', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ users: slackId })
                    });
                    const dmData = await dmOpen.json();
                    if (dmData.ok && dmData.channel) {
                        await sendSlackMessage(dmData.channel.id, dmText);
                        dmsSent++;
                    } else {
                        failedNames.push(name);
                    }
                } catch (e) {
                    failedNames.push(name);
                }
            }

            // Replace action tag with result summary
            let resultNote = `Sent DMs to ${dmsSent} employee${dmsSent !== 1 ? 's' : ''}.`;
            if (failedNames.length > 0) resultNote += ` Could not reach: ${failedNames.join(', ')} (no Slack ID linked).`;
            response = response.replace(match[0], '');
            response += `\n\n${resultNote}`;
        } catch (e) {
            console.error('DM_UNCONFIRMED error:', e);
            response = response.replace(match[0], '');
        }
    }

    // ALERT action
    const alertMatches = [...response.matchAll(/<!--ACTION:ALERT:(.+?)-->/g)];
    for (const match of alertMatches) {
        await sendAdminDM(match[1]);
        response = response.replace(match[0], '');
    }

    // Clean any remaining action tags
    response = response.replace(/<!--ACTION:.+?-->/g, '');

    return response.trim();
}

function generateKey() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 8; i++) key += chars[Math.floor(Math.random() * chars.length)];
    return key;
}

// ─── Helpers ───

async function sendAdminDM(text) {
    try {
        const dmResp = await fetch('https://slack.com/api/conversations.open', {
            method: 'POST',
            headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ users: ADMIN_USER_ID })
        });
        const dmData = await dmResp.json();
        if (dmData.ok && dmData.channel) {
            await sendSlackMessage(dmData.channel.id, text);
        }
    } catch(e) { console.error('Admin DM failed:', e); }
}

async function sbPatch(path, body) {
    const env = getSupabaseEnv();
    await fetch(env.url + path, {
        method: 'PATCH',
        headers: {
            apikey: env.anonKey, Authorization: `Bearer ${env.anonKey}`,
            'Content-Type': 'application/json', Prefer: 'return=representation'
        },
        body: JSON.stringify(body)
    });
}

async function getSlackUserName(slackUserId) {
    const result = await supabaseGet(`/rest/v1/employees?slack_user_id=eq.${slackUserId}`);
    const data = result.data || result;
    if (Array.isArray(data) && data[0]) return data[0].name;

    try {
        const resp = await fetch(`https://slack.com/api/users.info?user=${slackUserId}`, {
            headers: { Authorization: `Bearer ${BOT_TOKEN}` }
        });
        const info = await resp.json();
        if (info.ok) {
            const displayName = info.user.profile.display_name || info.user.real_name || info.user.name;
            const firstName = displayName.split(' ')[0];
            const empResult = await supabaseGet(`/rest/v1/employees?name=ilike.${encodeURIComponent(firstName + '%')}`);
            const empData = empResult.data || empResult;
            if (Array.isArray(empData) && empData[0]) {
                await sbPatch(`/rest/v1/employees?id=eq.${empData[0].id}`, { slack_user_id: slackUserId });
                return empData[0].name;
            }
        }
    } catch (e) {
        console.error('Slack user lookup failed:', e);
    }
    return null;
}

function fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return parseInt(m) === 0 ? `${h12} ${ampm}` : `${h12}:${m} ${ampm}`;
}

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
