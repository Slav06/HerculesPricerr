const { supabaseGet, supabasePost, supabasePatch } = require('./_supabase');

const SLACK_CHANNEL = 'C08LHBZ0LBZ';
const OWNER_SLACK_IDS = ['U08L6LYDJM9']; // Andy — get notified about staffing

// Quiet hours: no posts between midnight and 8am EST
function isQuietHours() {
    const now = new Date();
    const estHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours();
    return estHour >= 0 && estHour < 8;
}

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Slack helpers ──────────────────────────────────────────────────────────────

const userCache = {};

async function slackFetch(url) {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) throw new Error('SLACK_BOT_TOKEN not set');
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
}

async function resolveUser(userId) {
    if (userCache[userId]) return userCache[userId];
    try {
        const data = await slackFetch(`https://slack.com/api/users.info?user=${userId}`);
        const name =
            data.user?.profile?.display_name ||
            data.user?.profile?.real_name ||
            data.user?.real_name ||
            userId;
        userCache[userId] = name;
        return name;
    } catch {
        return userId;
    }
}

async function resolveUserMentions(text) {
    const mentions = text.match(/<@(U[A-Z0-9]+)>/g) || [];
    let resolved = text;
    for (const mention of mentions) {
        const uid = mention.replace(/<@|>/g, '');
        const name = await resolveUser(uid);
        resolved = resolved.replace(mention, `@${name}`);
    }
    return resolved;
}

// ── Fetch new Slack messages ───────────────────────────────────────────────────

async function fetchNewMessages() {
    // Get already-processed timestamps
    const processed = await supabaseGet(
        `/rest/v1/sandy_processed_messages?channel_id=eq.${SLACK_CHANNEL}&select=message_ts`
    );
    const processedSet = new Set((processed.data || []).map((r) => r.message_ts));

    // Fetch up to 200 recent messages
    const data = await slackFetch(
        `https://slack.com/api/conversations.history?channel=${SLACK_CHANNEL}&limit=200`
    );
    if (!data.ok) throw new Error(`Slack API error: ${data.error}`);

    const newMessages = (data.messages || []).filter((m) => !processedSet.has(m.ts));
    // Sort oldest first
    newMessages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
    return newMessages;
}

// ── Group messages into conversation chunks (10-min window) ────────────────────

function groupIntoChunks(messages, windowMinutes = 10) {
    if (!messages.length) return [];
    const windowSec = windowMinutes * 60;
    const chunks = [];
    let current = [messages[0]];

    for (let i = 1; i < messages.length; i++) {
        const prevTs = parseFloat(current[current.length - 1].ts);
        const curTs = parseFloat(messages[i].ts);
        if (curTs - prevTs <= windowSec) {
            current.push(messages[i]);
        } else {
            chunks.push(current);
            current = [messages[i]];
        }
    }
    chunks.push(current);
    return chunks;
}

// ── Sandy's self-improvement — learn from @Sandy instructions in Slack ────────

async function loadCustomRules() {
    const result = await supabaseGet(
        '/rest/v1/sandy_custom_rules?active=eq.true&select=*&order=created_at.desc'
    );
    return (result.data || []);
}

async function processSandyInstructions(messages) {
    const instructions = [];
    // Find messages directed at Sandy: @Sandy, "Sandy,", "sandy ", "hey sandy"
    for (const m of messages) {
        const text = m.text || '';
        const isSandyMention = /(?:@sandy|^sandy[,:\s]|hey sandy)/i.test(text);
        if (!isSandyMention) continue;

        const sender = m.senderName || 'someone';
        const instruction = text.replace(/(?:@sandy|^sandy)[,:\s]*/i, '').trim();
        if (!instruction || instruction.length < 5) continue;

        instructions.push({ sender, instruction, originalText: text, ts: m.ts });
    }

    const results = [];
    for (const inst of instructions) {
        const result = await parseAndSaveInstruction(inst);
        results.push(result);
    }
    return results;
}

async function parseAndSaveInstruction(inst) {
    const text = inst.instruction.toLowerCase();
    let rule = null;
    let confirmMsg = null;

    // "track X" / "start tracking X" — add a new keyword to watch for
    const trackMatch = inst.instruction.match(/(?:start\s+)?track(?:ing)?\s+["']?(.+?)["']?\s*$/i);
    if (trackMatch) {
        const keyword = trackMatch[1].trim();
        rule = {
            rule_type: 'track_keyword',
            keyword: keyword,
            action: 'note',
            intel_text: `${keyword} mentioned`,
            created_by: inst.sender,
            active: true,
        };
        confirmMsg = `Got it. I'll track *"${keyword}"* in conversations and log it to deal notes.`;
    }

    // "when you see X, note Y" / "if someone says X, add Y to notes"
    if (!rule) {
        const whenMatch = inst.instruction.match(/(?:when|if)\s+(?:you\s+)?(?:see|hear|someone\s+says?)\s+["']?(.+?)["']?\s*,?\s*(?:note|add|log|save|write)\s+["']?(.+?)["']?\s*$/i);
        if (whenMatch) {
            rule = {
                rule_type: 'track_keyword',
                keyword: whenMatch[1].trim(),
                action: 'note',
                intel_text: whenMatch[2].trim(),
                created_by: inst.sender,
                active: true,
            };
            confirmMsg = `Done. When I see *"${whenMatch[1].trim()}"*, I'll note: *"${whenMatch[2].trim()}"*`;
        }
    }

    // "when you see X, suggest Y"
    if (!rule) {
        const sugMatch = inst.instruction.match(/(?:when|if)\s+(?:you\s+)?(?:see|hear|someone\s+says?)\s+["']?(.+?)["']?\s*,?\s*(?:suggest|recommend|advise)\s+["']?(.+?)["']?\s*$/i);
        if (sugMatch) {
            rule = {
                rule_type: 'track_keyword',
                keyword: sugMatch[1].trim(),
                action: 'suggest',
                suggestion_text: sugMatch[2].trim(),
                intel_text: `${sugMatch[1].trim()} detected`,
                created_by: inst.sender,
                active: true,
            };
            confirmMsg = `On it. When I see *"${sugMatch[1].trim()}"*, I'll suggest: *"${sugMatch[2].trim()}"*`;
        }
    }

    // "stop tracking X" / "forget X" / "remove rule X"
    if (!rule) {
        const stopMatch = inst.instruction.match(/(?:stop\s+track(?:ing)?|forget|remove|delete|disable)\s+["']?(.+?)["']?\s*$/i);
        if (stopMatch) {
            const keyword = stopMatch[1].trim().toLowerCase();
            // Find and deactivate matching rules
            const existing = await supabaseGet(
                `/rest/v1/sandy_custom_rules?active=eq.true&keyword=ilike.${encodeURIComponent('%' + keyword + '%')}`
            );
            if (existing.data && existing.data.length > 0) {
                for (const r of existing.data) {
                    await supabasePatch(`/rest/v1/sandy_custom_rules?id=eq.${r.id}`, { active: false });
                }
                confirmMsg = `Done. Stopped tracking *"${keyword}"*. ${existing.data.length} rule${existing.data.length > 1 ? 's' : ''} disabled.`;
            } else {
                confirmMsg = `I don't have any active rules matching *"${keyword}"*. Nothing to remove.`;
            }
            // Post confirmation
            if (confirmMsg) {
                await sandyPost(SLACK_CHANNEL, confirmMsg);
                await trackSent(confirmMsg);
            }
            return { type: 'remove', keyword, confirmMsg };
        }
    }

    // "what are your rules" / "show rules" / "what do you track"
    if (!rule) {
        const listMatch = /(?:what|show|list)\s+(?:are\s+)?(?:your\s+)?(?:rules|tracking|custom)/i.test(inst.instruction);
        if (listMatch) {
            const rules = await loadCustomRules();
            if (rules.length === 0) {
                confirmMsg = "I don't have any custom rules yet. Teach me! Say something like:\n- *Sandy, track military discount*\n- *Sandy, when you see 'callback tomorrow', suggest follow up by noon*\n- *Sandy, stop tracking military discount*";
            } else {
                const ruleList = rules.map((r, i) =>
                    `${i + 1}. *${r.keyword}* -> ${r.intel_text}${r.suggestion_text ? ` (suggest: ${r.suggestion_text})` : ''} _(by ${r.created_by})_`
                ).join('\n');
                confirmMsg = `📋 *My custom rules (${rules.length}):*\n${ruleList}`;
            }
            await sandyPost(SLACK_CHANNEL, confirmMsg);
            await trackSent(confirmMsg);
            return { type: 'list', count: (await loadCustomRules()).length, confirmMsg };
        }
    }

    // ── Manual hours request ────────────────────────────────────────────────
    // "add 2 hours for today", "log 3h 30m for yesterday", "I worked 4 hours off the clock today"
    if (!rule) {
        const hoursPattern = /(?:add|log|worked|clock)\b/i;
        const timePattern = /(\d+(?:\.\d+)?)\s*(?:hours?|h)\b(?:\s*(\d+)\s*(?:minutes?|mins?|m)\b)?|(\d+)\s*(?:minutes?|mins?)\b/i;
        if (hoursPattern.test(text) && timePattern.test(inst.instruction)) {
            const result = await handleManualHoursRequest(inst);
            return result;
        }
    }

    // ── Remind / callback request ────────────────────────────────────────────
    // "remind X to call Y", "remind morning shift to call back Z at 9am"
    if (!rule) {
        const remindMatch = /remind|callback|call\s*back|follow.?up/i.test(text);
        if (remindMatch) {
            const result = await handleRemindRequest(inst);
            return result;
        }
    }

    // ── Unrecognized instruction — silently ignore ────────────────────────
    // Don't spam the channel with "Noted. I'll keep X in mind" for every unrecognized message.
    // Only save as a rule if it clearly looks like a tracking instruction.
    if (!rule) {
        // Silently skip — don't create junk rules or post generic responses
        return { type: 'unrecognized', instruction: inst.instruction };
    }

    // Save the rule
    if (rule) {
        // Check for duplicate
        const existing = await supabaseGet(
            `/rest/v1/sandy_custom_rules?active=eq.true&keyword=ilike.${encodeURIComponent(rule.keyword)}&limit=1`
        );
        if (existing.data && existing.data.length > 0) {
            // Update existing
            await supabasePatch(`/rest/v1/sandy_custom_rules?id=eq.${existing.data[0].id}`, {
                intel_text: rule.intel_text,
                suggestion_text: rule.suggestion_text || null,
                action: rule.action,
                created_by: rule.created_by,
            });
            confirmMsg = confirmMsg || `Updated my rule for *"${rule.keyword}"*.`;
        } else {
            await supabasePost('/rest/v1/sandy_custom_rules', rule);
        }

        // Confirm in Slack
        if (confirmMsg) {
            await sandyPost(SLACK_CHANNEL, confirmMsg);
            await trackSent(confirmMsg);
        }
    }

    return { type: rule?.rule_type || 'unknown', rule, confirmMsg };
}

// ── Remind / callback request handler ─────────────────────────────────────────

async function handleRemindRequest(inst) {
    const token = process.env.SLACK_BOT_TOKEN;
    const text = inst.instruction;

    // Extract job number if present
    const jobMatch = text.match(/\b([AS]\d{7})\b/i);
    const jobNumber = jobMatch ? jobMatch[1].toUpperCase() : null;

    // Extract customer name — look for patterns like "call back [Name]" or "call [Name]"
    let customerName = null;
    const nameMatch = text.match(/(?:call\s*back|remind.*(?:call|contact))\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (nameMatch) customerName = nameMatch[1];
    // Also try to find a name near the job number
    if (!customerName && jobNumber) {
        const nearJob = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+[AS]\d{7}/i);
        if (nearJob) customerName = nearJob[1];
    }

    // Extract time — "9am", "at 10", "by noon"
    let reminderTime = null;
    const timeMatch = text.match(/(?:at\s+)?(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)/i);
    if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        const min = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const ampm = timeMatch[3].toLowerCase();
        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
        reminderTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
    if (!reminderTime && /\bnoon\b/i.test(text)) reminderTime = '12:00';
    if (!reminderTime && /\bmorning\b/i.test(text)) reminderTime = '09:00';

    // Extract who to remind — look for names after "remind"
    const targetNames = [];
    const remindWhoMatch = text.match(/remind\s+(.+?)(?:\s+to\s+|\s+tomorrow|\s+about|\s+at\s+\d)/i);
    if (remindWhoMatch) {
        const namesPart = remindWhoMatch[1].replace(/(?:the\s+)?morning\s+shift/i, '').trim();
        if (namesPart && !/^(me|us|them)$/i.test(namesPart)) {
            // Split by "and" or ","
            namesPart.split(/\s+and\s+|,\s*/i).forEach(n => {
                const cleaned = n.trim();
                if (cleaned && cleaned.length > 1) targetNames.push(cleaned);
            });
        }
    }
    // If "morning shift" mentioned, look up who's on tomorrow morning
    const isMorningShift = /morning\s*shift/i.test(text);

    // Determine target date — default tomorrow
    let targetDate = 'tomorrow';
    if (/\btoday\b/i.test(text)) targetDate = 'today';

    // Look up morning shift schedule if needed
    let shiftNames = [];
    if (isMorningShift || targetNames.length === 0) {
        const now = new Date();
        const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const targetDay = new Date(estNow);
        if (targetDate === 'tomorrow') targetDay.setDate(targetDay.getDate() + 1);
        const dateStr = `${targetDay.getFullYear()}-${String(targetDay.getMonth()+1).padStart(2,'0')}-${String(targetDay.getDate()).padStart(2,'0')}`;

        const schedResult = await supabaseGet(
            `/rest/v1/schedule_entries?schedule_date=eq.${dateStr}&status=neq.callout&order=shift_start`
        );
        const entries = Array.isArray(schedResult.data) ? schedResult.data : [];
        // Morning = shift_start before 12:00
        const morningEntries = entries.filter(e => {
            if (!e.shift_start) return false;
            const hour = parseInt(e.shift_start.split(':')[0]);
            return hour < 12;
        });
        shiftNames = morningEntries.map(e => e.employee_name);
    }

    const finalTargets = targetNames.length > 0 ? targetNames : shiftNames;
    const targetsStr = finalTargets.length > 0 ? finalTargets.join(' & ') : 'morning shift';

    // Build the reminder message
    const reminderParts = [];
    if (customerName) reminderParts.push(`call back *${customerName}*`);
    if (jobNumber) reminderParts.push(`job *${jobNumber}*`);
    if (reminderTime) reminderParts.push(`at *${reminderTime}*`);
    const reminderAction = reminderParts.length > 0 ? reminderParts.join(' — ') : text;

    // Save reminder to Supabase
    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const reminderDate = new Date(estNow);
    if (targetDate === 'tomorrow') reminderDate.setDate(reminderDate.getDate() + 1);
    const reminderDateStr = `${reminderDate.getFullYear()}-${String(reminderDate.getMonth()+1).padStart(2,'0')}-${String(reminderDate.getDate()).padStart(2,'0')}`;

    await supabasePost('/rest/v1/sandy_reminders', {
        targets: finalTargets.join(', ') || 'morning shift',
        reminder_text: `${reminderAction} (requested by ${inst.sender})`,
        reminder_date: reminderDateStr,
        reminder_time: reminderTime || '09:00',
        job_number: jobNumber,
        customer_name: customerName,
        status: 'pending',
        created_by: inst.sender,
    });

    // Also save to job notes if we have a job number
    if (jobNumber) {
        const jobResult = await supabaseGet(
            `/rest/v1/job_submissions?job_number=eq.${encodeURIComponent(jobNumber)}&select=id,notes&limit=1`
        );
        if (jobResult.data && jobResult.data.length > 0) {
            const job = jobResult.data[0];
            const existingNotes = job.notes || '';
            const timestamp = now.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            const newNote = `\n\n--- Callback Reminder (${timestamp}) ---\nCallback ${targetDate} ${reminderTime || '9AM'} — ${targetsStr}\nSet by: ${inst.sender}`;
            if (!existingNotes.includes('Callback Reminder')) {
                await supabasePatch(`/rest/v1/job_submissions?id=eq.${job.id}`, { notes: existingNotes + newNote });
            }
        }
    }

    // Confirm in channel
    const confirmMsg = `Got it ${inst.sender}. I'll remind *${targetsStr}* ${targetDate}${reminderTime ? ' at ' + reminderTime : ''} to ${customerName ? 'call back *' + customerName + '*' : 'follow up'}${jobNumber ? ' (' + jobNumber + ')' : ''}.`;
    await sandyPost(SLACK_CHANNEL, confirmMsg);
    await trackSent(confirmMsg);

    return { type: 'reminder', targets: finalTargets, customerName, jobNumber, reminderTime, confirmMsg };
}

// ── Manual hours request handler ─────────────────────────────────────────────

function parseHoursFromText(text) {
    // "2.5 hours" or "2 hours 30 minutes" or "2h 30m" or "2h30m" or "90 minutes"
    let totalMinutes = 0;

    // Try "Xh Ym" or "X hours Y minutes" pattern first
    const hm = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|h)\s*(\d+)\s*(?:minutes?|mins?|m)\b/i);
    if (hm) {
        totalMinutes = Math.round(parseFloat(hm[1]) * 60) + parseInt(hm[2], 10);
        return totalMinutes;
    }

    // "X hours" or "X.Y hours" or "Xh"
    const hOnly = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|h)\b/i);
    if (hOnly) {
        totalMinutes = Math.round(parseFloat(hOnly[1]) * 60);
        return totalMinutes;
    }

    // "X minutes" or "X mins" or "Xm" (standalone, not after hours)
    const mOnly = text.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i);
    if (mOnly) {
        totalMinutes = parseInt(mOnly[1], 10);
        return totalMinutes;
    }

    return 0;
}

function parseDateFromText(text) {
    const now = new Date();
    const lower = text.toLowerCase();

    // "yesterday"
    if (/\byesterday\b/i.test(lower)) {
        const d = new Date(now);
        d.setDate(d.getDate() - 1);
        return d;
    }

    // "today" or no date specified (handled later as default)
    if (/\btoday\b/i.test(lower)) {
        return now;
    }

    // "March 18" or "mar 18"
    const monthName = lower.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/i);
    if (monthName) {
        const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        const key = monthName[1].substring(0, 3).toLowerCase();
        const month = months[key];
        const day = parseInt(monthName[2], 10);
        if (month !== undefined && day >= 1 && day <= 31) {
            const d = new Date(now.getFullYear(), month, day);
            // If the date is in the future, assume last year
            if (d > now) d.setFullYear(d.getFullYear() - 1);
            return d;
        }
    }

    // "3/18" or "03/18"
    const slashDate = lower.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    if (slashDate) {
        const month = parseInt(slashDate[1], 10) - 1;
        const day = parseInt(slashDate[2], 10);
        if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            const d = new Date(now.getFullYear(), month, day);
            if (d > now) d.setFullYear(d.getFullYear() - 1);
            return d;
        }
    }

    // Default to today
    return now;
}

function formatDateYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDateReadable(d) {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

async function handleManualHoursRequest(inst) {
    const ANDY_SLACK_ID = 'U08L6LYDJM9';
    const token = process.env.SLACK_BOT_TOKEN;

    // Parse hours and date
    const totalMinutes = parseHoursFromText(inst.instruction);
    if (totalMinutes <= 0) {
        const msg = `Sorry ${inst.sender}, I couldn't figure out the hours from your message. Try something like: *add 2 hours for today* or *log 1h 30m for yesterday*.`;
        await sandyPost(SLACK_CHANNEL, msg);
        await trackSent(msg);
        return { type: 'manual_hours', error: 'parse_failed', confirmMsg: msg };
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const parsedDate = parseDateFromText(inst.instruction);
    const dateStr = formatDateYMD(parsedDate);
    const dateReadable = formatDateReadable(parsedDate);

    // Look up employee by sender name
    const empResult = await supabaseGet(
        `/rest/v1/employees?name=ilike.%25${encodeURIComponent(inst.sender)}%25&is_active=eq.true&limit=1`
    );
    const employee = empResult.data && empResult.data.length > 0 ? empResult.data[0] : null;

    if (!employee) {
        const msg = `Sorry ${inst.sender}, I couldn't find your employee record. Please ask Andy to make sure your name in Slack matches the employees table.`;
        await sandyPost(SLACK_CHANNEL, msg);
        await trackSent(msg);
        return { type: 'manual_hours', error: 'employee_not_found', confirmMsg: msg };
    }

    if (!employee.worksnap_id) {
        const msg = `Sorry ${inst.sender}, your employee record doesn't have a Worksnap ID set up. Please ask Andy to add it.`;
        await sandyPost(SLACK_CHANNEL, msg);
        await trackSent(msg);
        return { type: 'manual_hours', error: 'no_worksnap_id', confirmMsg: msg };
    }

    // Calculate estimated pay
    const hourlyRate = employee.hourly_rate || 0;
    const estimatedPay = ((totalMinutes / 60) * hourlyRate).toFixed(2);

    // Insert pending request into Supabase
    const insertResult = await supabasePost('/rest/v1/manual_hours_requests', {
        employee_name: employee.name,
        worksnap_id: employee.worksnap_id,
        date: dateStr,
        duration_minutes: totalMinutes,
        reason: inst.instruction,
        requested_via: 'slack',
        status: 'pending',
    });

    // Try to get the request ID from the insert response
    const requestId = (insertResult.data && insertResult.data[0] && insertResult.data[0].id)
        ? insertResult.data[0].id
        : 'N/A';

    // DM Andy for approval
    try {
        // Open DM with Andy
        const dmOpen = await fetch('https://slack.com/api/conversations.open', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ users: ANDY_SLACK_ID }),
        });
        const dmData = await dmOpen.json();

        if (dmData.ok && dmData.channel && dmData.channel.id) {
            const dmChannel = dmData.channel.id;
            const baseUrl = 'https://www.herculesmovingsolutions.com';
            const approveUrl = `${baseUrl}/api/manual-hours?action=approve&request_id=${requestId}&approved_by=Andy`;
            const rejectUrl = `${baseUrl}/api/manual-hours?action=reject&request_id=${requestId}&rejected_by=Andy`;
            const approvalMsg = [
                `:clock3: *Manual Hours Request*`,
                ``,
                `*Employee:* ${employee.name}`,
                `*Date:* ${dateReadable} (${dateStr})`,
                `*Hours:* ${hours}h ${minutes}m (${totalMinutes} minutes)`,
                `*Estimated Pay:* $${estimatedPay} (at $${hourlyRate}/hr)`,
                `*Reason:* ${inst.instruction}`,
                ``,
                `<${approveUrl}|:white_check_mark: Approve>    <${rejectUrl}|:x: Reject>`,
            ].join('\n');

            await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    channel: dmChannel,
                    text: approvalMsg,
                    username: 'Sandy',
                    icon_url: 'https://pricerr.vercel.app/sandy-avatar.jpg',
                }),
            });
        }
    } catch (e) {
        console.error('Failed to DM Andy for manual hours approval:', e);
    }

    // Confirm to employee in channel
    const confirmMsg = `Got it ${inst.sender}, I've sent your request for ${hours}h ${minutes}m on ${dateReadable} to Andy for approval.`;
    await sandyPost(SLACK_CHANNEL, confirmMsg);
    await trackSent(confirmMsg);

    return { type: 'manual_hours', requestId, employee: employee.name, totalMinutes, date: dateStr, confirmMsg };
}

// Apply custom rules during deal intel extraction
function applyCustomRules(chunkText, customRules) {
    const intel = [];
    const suggestions = [];

    for (const rule of customRules) {
        if (!rule.active || !rule.keyword) continue;
        const regex = new RegExp(rule.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        if (regex.test(chunkText)) {
            if (rule.intel_text) intel.push(rule.intel_text);
            if (rule.suggestion_text) suggestions.push(rule.suggestion_text);
        }
    }

    return { intel, suggestions };
}

// ── Deal intel extraction — find job numbers & extract conversation insights ──

function extractDealIntel(chunkText, messages, customRules) {
    const deals = [];

    // Find job numbers (A or S followed by 7 digits)
    const jobRegex = /\b([AS]\d{7})\b/gi;
    const jobNumbers = new Set();
    let match;
    while ((match = jobRegex.exec(chunkText)) !== null) {
        jobNumbers.add(match[1].toUpperCase());
    }

    if (jobNumbers.size === 0) return { deals: [], patterns: extractGeneralPatterns(chunkText) };

    for (const jobNumber of jobNumbers) {
        const intel = [];
        const suggestions = [];

        // Find which rep is discussing this deal
        let rep = null;
        if (messages && messages.length) {
            rep = messages[0].senderName || null;
        }

        // Customer sentiment
        if (/likes?\s*(the\s+)?price/i.test(chunkText)) intel.push('Customer likes the price');
        if (/doesn.t like|too (expensive|much|high)/i.test(chunkText)) {
            intel.push('Customer thinks price is too high');
            suggestions.push('Consider offering a small discount or payment plan to close');
        }
        if (/likes?\s*(our\s+)?service/i.test(chunkText)) intel.push('Customer likes our service offerings');
        if (/disassembly|assembly/i.test(chunkText)) intel.push('Customer interested in disassembly/assembly service');
        if (/pack|packing/i.test(chunkText) && !/package/i.test(chunkText)) intel.push('Customer interested in packing services');
        if (/storage/i.test(chunkText) && !/storage unit/i.test(chunkText)) intel.push('Customer may need storage');

        // Urgency & timeline
        if (/urgent|asap|rush|right away|immediately/i.test(chunkText)) {
            intel.push('Customer has urgency');
            suggestions.push('Hot lead - close quickly before they shop around');
        }
        if (/split\s*(the\s+)?cost|splitting/i.test(chunkText)) intel.push('Customer splitting move cost with someone');
        if (/flexible|no rush|whenever/i.test(chunkText)) {
            intel.push('Customer has flexible timeline');
            suggestions.push('Flexible date - offer off-peak discount to lock in');
        }

        // Competitor context
        if (/broker|brokers/i.test(chunkText)) {
            intel.push('Customer got quotes from brokers');
            suggestions.push('Emphasize we are actual carriers, not brokers - no middleman markup');
        }
        if (/other quotes?|shopping around|comparing/i.test(chunkText)) {
            intel.push('Customer is comparing quotes');
            suggestions.push('Create urgency - dates fill up, price lock expires');
        }
        if (/didn.t want.*broker|doesn.t want.*broker|don.t want.*broker/i.test(chunkText)) {
            intel.push('Customer prefers carrier over broker');
        }

        // Sales tactics used
        if (/setup urgency|created? urgency/i.test(chunkText)) intel.push('Rep used urgency tactic');
        if (/t\.?o\.?\b|turnover|turn over/i.test(chunkText)) {
            intel.push('Lead was turned over');
            suggestions.push('T.O. lead - fresh closer should rebuild rapport first');
        }
        if (/deposit|put down|hold.*date/i.test(chunkText)) intel.push('Deposit discussed');
        if (/discount|took off|knocked off|lowered/i.test(chunkText)) intel.push('Discount was offered');
        if (/minimum|min charge/i.test(chunkText)) intel.push('Minimum charge discussed');

        // Objections
        if (/think about it|get back to/i.test(chunkText)) {
            intel.push('Customer wants to think about it');
            suggestions.push('Follow up within 2 hours - "thinking about it" leads go cold fast');
        }
        if (/budget|can.t afford|money tight/i.test(chunkText)) {
            intel.push('Customer has budget concerns');
            suggestions.push('Offer payment plan or break down cost per day to make it feel smaller');
        }
        if (/reviews?|bbb|yelp|google/i.test(chunkText)) {
            intel.push('Customer checking reviews');
            suggestions.push('Share positive reviews proactively - Google link or testimonials');
        }
        if (/scam|legit|trust|rip.?off/i.test(chunkText)) {
            intel.push('Customer has trust concerns');
            suggestions.push('Share DOT/MC number, insurance info, and real customer reviews');
        }

        // Follow-up / callback
        if (/callback|call\s*back|follow.?up|calling.*back/i.test(chunkText)) {
            intel.push('Follow-up/callback needed');
            suggestions.push('Set a specific callback time - vague "I\'ll call back" = lost lead');
        }

        // Booking signals
        if (/\bbook(ed|ing)?\b|ready to go|let.s do it|sign(ed)?|locked in/i.test(chunkText)) {
            intel.push('Customer showing booking signals');
            suggestions.push('Close now - get deposit and send agreement immediately');
        }

        // Pricing context
        const pricingRegex = /(\d+)\s*(?:cf|cubes?)\s+(\d+)\s*miles?/gi;
        while ((match = pricingRegex.exec(chunkText)) !== null) {
            const after = chunkText.slice(match.index, match.index + 200);
            const priceMatch = after.match(/\$\s*(\d{3,6})/);
            if (priceMatch) {
                intel.push(`Pricing discussed: ${match[1]}cf, ${match[2]} miles -> $${priceMatch[1]}`);
            }
        }

        // Caff lead / specific lead types
        if (/caff\s*lead/i.test(chunkText)) intel.push('CAFF lead type');

        // Apply custom rules from Sandy's self-improvement system
        if (customRules && customRules.length > 0) {
            const custom = applyCustomRules(chunkText, customRules);
            intel.push(...custom.intel);
            suggestions.push(...custom.suggestions);
        }

        if (intel.length > 0) {
            deals.push({ jobNumber, intel, rep, suggestions });
        }
    }

    const patterns = extractGeneralPatterns(chunkText);
    return { deals, patterns };
}

// ── General pattern extraction (for knowledge base, not deal-specific) ────────

function extractGeneralPatterns(chunkText) {
    const patterns = [];
    let match;

    // Pricing
    const pricingRegex = /(\d+)\s*cf\s+(\d+)\s*miles?/gi;
    while ((match = pricingRegex.exec(chunkText)) !== null) {
        const cf = match[1];
        const miles = match[2];
        const after = chunkText.slice(match.index, match.index + 200);
        const priceMatch = after.match(/\$?\s*(\d{3,5})/);
        const price = priceMatch ? priceMatch[1] : 'unknown';
        patterns.push({
            category: 'pricing',
            title: `${cf}cf ${miles} miles pricing`,
            content: `${cf} cf, ${miles} miles -> $${price}. Context: ${after.slice(0, 150).trim()}`,
            confidence: price !== 'unknown' ? 0.9 : 0.6,
        });
    }

    // Objection handling
    const objectionKeywords = ['budget', 'competitor', 'reviews', 'think about it', 'binding', 'too expensive', 'too much', 'better price', 'cheaper'];
    for (const kw of objectionKeywords) {
        const idx = chunkText.toLowerCase().indexOf(kw);
        if (idx !== -1) {
            const snippet = chunkText.slice(Math.max(0, idx - 80), idx + 120).trim();
            patterns.push({ category: 'objection', title: `Objection: ${kw}`, content: snippet, confidence: 0.7 });
        }
    }

    // Tactics
    const tacticKeywords = ['urgency', 'deposit', 'T.O.', 'turnover', 'discount', 'lock in', 'hold the date', 'waive', 'throw in'];
    for (const kw of tacticKeywords) {
        const idx = chunkText.toLowerCase().indexOf(kw.toLowerCase());
        if (idx !== -1) {
            const snippet = chunkText.slice(Math.max(0, idx - 80), idx + 120).trim();
            patterns.push({ category: 'tactic', title: `Tactic: ${kw}`, content: snippet, confidence: 0.7 });
        }
    }

    // Competitor mentions
    const competitorKeywords = ['moving.com', 'uhaul', 'u-haul', 'pods', 'two men', 'college hunks', 'safeway', 'allied', 'mayflower'];
    for (const kw of competitorKeywords) {
        const idx = chunkText.toLowerCase().indexOf(kw.toLowerCase());
        if (idx !== -1) {
            const snippet = chunkText.slice(Math.max(0, idx - 80), idx + 120).trim();
            patterns.push({ category: 'competitor', title: `Competitor: ${kw}`, content: snippet, confidence: 0.8 });
        }
    }

    return patterns;
}

// ── Save deal intel to job notes ──────────────────────────────────────────────

async function saveDealIntelToNotes(deals) {
    const saved = [];
    for (const deal of deals) {
        const jobResult = await supabaseGet(
            `/rest/v1/job_submissions?job_number=eq.${encodeURIComponent(deal.jobNumber)}&select=id,notes,job_number&limit=1`
        );
        if (!jobResult.data || !jobResult.data.length) continue;

        const job = jobResult.data[0];
        const existingNotes = job.notes || '';

        const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        const intelLines = deal.intel.map(i => `- ${i}`).join('\n');
        const sugLines = deal.suggestions.length ? '\nSuggestions:\n' + deal.suggestions.map(s => `> ${s}`).join('\n') : '';
        const newNote = `\n\n--- Sandy Intel (${timestamp}) ---\n${deal.rep ? `Rep: ${deal.rep}\n` : ''}${intelLines}${sugLines}`;

        // Avoid duplicates: check if the first intel line already exists in notes
        if (existingNotes.includes(deal.intel[0])) continue;

        const updatedNotes = existingNotes + newNote;
        await supabasePatch(
            `/rest/v1/job_submissions?id=eq.${job.id}`,
            { notes: updatedNotes }
        );
        saved.push({ jobNumber: deal.jobNumber, intelCount: deal.intel.length, suggestions: deal.suggestions.length });
    }
    return saved;
}

// ── Upsert knowledge ───────────────────────────────────────────────────────────

async function upsertKnowledge(pattern) {
    const existing = await supabaseGet(
        `/rest/v1/sandy_knowledge?title=ilike.${encodeURIComponent(pattern.title)}&active=eq.true&limit=1`
    );

    if (existing.data && existing.data.length > 0) {
        const row = existing.data[0];
        await supabasePatch(
            `/rest/v1/sandy_knowledge?id=eq.${row.id}`,
            {
                times_seen: row.times_seen + 1,
                last_seen_at: new Date().toISOString(),
                content: pattern.content,
                confidence: Math.min(1, row.confidence + 0.02),
            }
        );
        return 'updated';
    } else {
        await supabasePost('/rest/v1/sandy_knowledge', {
            category: pattern.category,
            title: pattern.title,
            content: pattern.content,
            source_channel: 'sales-floor',
            confidence: pattern.confidence,
        });
        return 'inserted';
    }
}

// ── Mark messages as processed ─────────────────────────────────────────────────

async function markProcessed(messages) {
    if (!messages.length) return;
    const rows = messages.map((m) => ({
        channel_id: SLACK_CHANNEL,
        message_ts: m.ts,
    }));
    for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        await supabasePost('/rest/v1/sandy_processed_messages', batch);
    }
}

// ── Team member tracking ──────────────────────────────────────────────────────

function extractTeamActivity(messages) {
    const activity = {};
    for (const m of messages) {
        const name = m.senderName || 'unknown';
        if (name === 'unknown' || name === 'Sandy') continue;
        if (!activity[name]) activity[name] = { messages: 0, pricing_asks: 0, transfers: 0, otps: 0, bookings: 0, drops: 0 };
        activity[name].messages++;
        const text = (m.text || '').toLowerCase();
        if (/price\??|cf\s+\d+\s*miles?/i.test(text)) activity[name].pricing_asks++;
        if (/transfer|connecting|t\.o\./i.test(text)) activity[name].transfers++;
        if (/\botp\b/i.test(text)) activity[name].otps++;
        if (/book|booked|close|closed/i.test(text)) activity[name].bookings++;
        if (/drop|dropped|lost|didnt work|didn.t work|no answer/i.test(text)) activity[name].drops++;
    }
    return activity;
}

async function upsertTeamStats(activity) {
    for (const [name, stats] of Object.entries(activity)) {
        if (stats.messages < 1) continue;
        const existing = await supabaseGet(
            `/rest/v1/sandy_knowledge?category=eq.team_member&title=eq.${encodeURIComponent('Rep: ' + name)}&active=eq.true&limit=1`
        );
        if (existing.data && existing.data.length > 0) {
            const row = existing.data[0];
            let prev = {};
            try { prev = JSON.parse(row.content); } catch(e) {}
            const merged = {
                total_messages: (prev.total_messages || 0) + stats.messages,
                total_pricing_asks: (prev.total_pricing_asks || 0) + stats.pricing_asks,
                total_transfers: (prev.total_transfers || 0) + stats.transfers,
                total_otps: (prev.total_otps || 0) + stats.otps,
                total_bookings: (prev.total_bookings || 0) + stats.bookings,
                total_drops: (prev.total_drops || 0) + stats.drops,
            };
            await supabasePatch(`/rest/v1/sandy_knowledge?id=eq.${row.id}`, {
                content: JSON.stringify(merged),
                times_seen: row.times_seen + 1,
                last_seen_at: new Date().toISOString(),
            });
        } else {
            await supabasePost('/rest/v1/sandy_knowledge', {
                category: 'team_member',
                title: 'Rep: ' + name,
                content: JSON.stringify({
                    total_messages: stats.messages,
                    total_pricing_asks: stats.pricing_asks,
                    total_transfers: stats.transfers,
                    total_otps: stats.otps,
                    total_bookings: stats.bookings,
                    total_drops: stats.drops,
                }),
                source_channel: 'sales-floor',
                confidence: 0.9,
            });
        }
    }
}

// ── Sandy's personality — never repeat, always fresh ─────────────────────────

let _recentlySent = new Set();

async function loadRecentMessages() {
    const result = await supabaseGet(
        '/rest/v1/sandy_sent_messages?select=message_hash&order=created_at.desc&limit=30'
    );
    if (result.data) result.data.forEach(r => _recentlySent.add(r.message_hash));
}

function hashMsg(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    return String(h);
}

async function trackSent(text) {
    const hash = hashMsg(text);
    _recentlySent.add(hash);
    await supabasePost('/rest/v1/sandy_sent_messages', {
        message_hash: hash,
        message_preview: text.slice(0, 100),
    }).catch(() => {});
}

const SANDY_LINES = {
    drop: [
        "Another one bites the dust.",
        "That lead had a whole family waiting on that move.",
        "I've seen better closing from a broken vending machine.",
        "RIP. Gone but not forgotten. Well, maybe a little forgotten.",
        "And just like that, someone else is moving them.",
        "That lead didn't ghost you - it sprinted.",
        "Bold move. Let's see if 'not closing' pays rent.",
        "Somewhere a competitor just high-fived their team.",
        "Oof. That one's gonna haunt you at 3am.",
        "You miss 100% of the shots you don't take. And apparently some you do.",
        "I'm not mad, I'm just disappointed. Actually, I'm a little mad.",
        "That deal died so fast it didn't even get a funeral.",
        "Adding that to the 'lessons learned' pile. It's getting tall.",
        "The lead wanted to be closed. It was begging. And yet.",
        "At this rate we should just start a charity.",
    ],
    quiet: [
        "Did everyone forget they work here or...",
        "I can literally hear crickets through the internet.",
        "The phones are collecting dust. Real motivating.",
        "Just me and the silence out here. Cool. Cool cool cool.",
        "If the floor gets any quieter I'm filing a missing persons report.",
        "Hello? Is anybody actually working today?",
        "I've been listening for 30 minutes and heard nothing. Incredible.",
    ],
    booking: [
        "Wait. Hold on. Someone actually CLOSED? Today?",
        "Money in the building. About time.",
        "Now THAT'S what the job is. The rest of you - watch and learn.",
        "Finally some good news. I was starting to lose hope.",
        "Booking confirmed. Morale restored. Temporarily.",
        "Someone woke up and chose revenue today.",
        "A booking! In THIS economy? Respect.",
    ],
    hustle: [
        "Respect the grind.",
        "OTP machine mode activated.",
        "That's the energy. Wish it was contagious.",
        "Look at that hustle. Someone wants to get paid.",
        "Dialing like their rent depends on it. Because it does.",
        "Main character energy right there.",
    ],
    pricing: [
        "Price check - on it.",
        "Math time. My favorite.",
    ],
};

function sandyRoast(category) {
    const pool = SANDY_LINES[category];
    if (!pool || !pool.length) return null;
    const fresh = pool.filter(line => !_recentlySent.has(hashMsg(line)));
    if (!fresh.length) {
        return pool[Math.floor(Math.random() * pool.length)];
    }
    return fresh[Math.floor(Math.random() * fresh.length)];
}

// ── Action: learn ──────────────────────────────────────────────────────────────

async function runLearn() {
    await loadRecentMessages();

    const messages = await fetchNewMessages();
    if (!messages.length) {
        return { learned: 0, message: 'No new messages to process' };
    }

    // Resolve user mentions in all messages
    for (const msg of messages) {
        if (msg.text) {
            msg.text = await resolveUserMentions(msg.text);
        }
        if (msg.user) {
            msg.senderName = await resolveUser(msg.user);
        }
    }

    // Load custom rules for deal intel extraction
    const customRules = await loadCustomRules();

    // Track team member activity
    const teamActivity = extractTeamActivity(messages);
    await upsertTeamStats(teamActivity);

    // Group into conversation chunks
    const chunks = groupIntoChunks(messages);

    let inserted = 0;
    let updated = 0;
    const allPatterns = [];
    const allDeals = [];

    for (const chunk of chunks) {
        const chunkText = chunk
            .map((m) => `${m.senderName || 'unknown'}: ${m.text || ''}`)
            .join('\n');

        // Extract deal-specific intel (job numbers + insights) with custom rules
        const { deals, patterns } = extractDealIntel(chunkText, chunk, customRules);
        allDeals.push(...deals);

        // Also store general patterns in knowledge base
        for (const p of patterns) {
            const result = await upsertKnowledge(p);
            if (result === 'inserted') inserted++;
            else updated++;
            allPatterns.push({ ...p, result });
        }
    }

    // Save deal intel to job notes
    let savedDeals = [];
    if (allDeals.length > 0) {
        savedDeals = await saveDealIntelToNotes(allDeals);
    }

    await markProcessed(messages);

    return {
        messagesProcessed: messages.length,
        chunks: chunks.length,
        inserted,
        updated,
        learned: inserted + updated,
        dealsFound: allDeals.length,
        dealsSaved: savedDeals,
        customRulesApplied: customRules.length,
        teamActivity,
        patterns: allPatterns.slice(0, 50),
    };
}

// ── Slack: post a message as Sandy ─────────────────────────────────────────────

async function sandyPost(channel, text) {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) throw new Error('SLACK_BOT_TOKEN not set');
    const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            channel,
            text,
            username: 'Sandy',
            icon_url: 'https://pricerr.vercel.app/sandy-avatar.jpg',
        }),
    });
    return res.json();
}

// ── Sandy's smart alerts — only posts when something actually matters ─────────

async function runSmartAlerts() {
    if (isQuietHours()) return { skipped: true, reason: 'quiet_hours' };
    await loadRecentMessages();

    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayStr = `${estNow.getFullYear()}-${String(estNow.getMonth()+1).padStart(2,'0')}-${String(estNow.getDate()).padStart(2,'0')}`;
    const alerts = [];

    // 1. Overdue callbacks — cycle through them, most recent first, don't repeat same ones
    // Fetch ALL overdue (no date cutoff — they're all valid) sorted most recent first
    const overdueResult = await supabaseGet(
        `/rest/v1/job_submissions?callback_datetime=lt.${now.toISOString()}&status=not.in.(Booked,dropped,disqualified,lost_to_competitor,booked,cancelled,hung_up,wrong_number,disconnected,booked_to_competitor)&select=id,job_number,customer_name,callback_datetime,assigned_to,status&order=callback_datetime.desc&limit=50`
    );
    const allOverdue = (overdueResult.data || []).filter(j => {
        const cb = new Date(j.callback_datetime);
        return (now - cb) > 60 * 60 * 1000;
    });

    if (allOverdue.length > 0) {
        // Check which job numbers Sandy already alerted about today
        const alertedResult = await supabaseGet(
            `/rest/v1/sandy_sent_messages?message_preview=ilike.%25overdue%25&created_at=gt.${todayStr}T00:00:00Z&select=message_preview&order=created_at.desc&limit=50`
        );
        const alreadyAlerted = new Set();
        (alertedResult.data || []).forEach(r => {
            // Extract job numbers from previous alert previews
            const matches = (r.message_preview || '').match(/[AS]\d{7}/gi) || [];
            matches.forEach(m => alreadyAlerted.add(m.toUpperCase()));
        });

        // Filter to ones not yet alerted today, keep most recent first
        const fresh = allOverdue.filter(j => !alreadyAlerted.has((j.job_number || '').toUpperCase()));

        // Show up to 3 at a time (not 5 — less overwhelming)
        const batch = fresh.slice(0, 3);
        if (batch.length > 0) {
            const lines = batch.map(j => {
                const cb = new Date(j.callback_datetime);
                const diffMs = now - cb;
                const hoursAgo = Math.round(diffMs / (60 * 60 * 1000));
                const who = j.assigned_to || 'unassigned';
                let timeLabel;
                if (hoursAgo < 24) timeLabel = `${hoursAgo}h ago`;
                else { const days = Math.round(hoursAgo / 24); timeLabel = `${days} day${days > 1 ? 's' : ''} ago`; }
                return `• *${j.job_number}* ${j.customer_name} — callback was ${timeLabel} (${who})`;
            });
            const remaining = fresh.length - batch.length;
            let msg = `⏰ *${batch.length} overdue callback${batch.length > 1 ? 's' : ''} to handle:*\n${lines.join('\n')}`;
            if (remaining > 0) msg += `\n_${remaining} more coming up next round_`;
            alerts.push(msg);
        } else if (allOverdue.length > 0) {
            // All have been alerted today already — just show a count reminder once
            if (!alreadyAlerted.has('DAILY_TOTAL_REMINDER')) {
                alerts.push(`📋 *${allOverdue.length} total overdue callbacks today.* I've called them all out individually — check the list above.`);
            }
        }
    }

    // 2. Stale leads — pending for 2+ days with no callback set, no assignment
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const staleResult = await supabaseGet(
        `/rest/v1/job_submissions?status=eq.pending&callback_datetime=is.null&assigned_to=is.null&submitted_at=lt.${twoDaysAgo}&select=id,job_number,customer_name,submitted_at&order=submitted_at.asc&limit=10`
    );
    const stale = staleResult.data || [];
    if (stale.length > 0) {
        const lines = stale.slice(0, 5).map(j => {
            const days = Math.round((now - new Date(j.submitted_at)) / (24 * 60 * 60 * 1000));
            return `• *${j.job_number}* ${j.customer_name} — ${days} days, untouched`;
        });
        let msg = `🧊 *${stale.length} stale lead${stale.length > 1 ? 's' : ''} going cold:*\n${lines.join('\n')}`;
        if (stale.length > 5) msg += `\n_...and ${stale.length - 5} more_`;
        alerts.push(msg);
    }

    // 3. Today's fresh leads with no contact — submitted today, still pending, no callback
    const freshResult = await supabaseGet(
        `/rest/v1/job_submissions?status=eq.pending&submitted_at=gte.${todayStr}T00:00:00&callback_datetime=is.null&select=id,job_number,customer_name,submitted_at&order=submitted_at.desc`
    );
    const fresh = freshResult.data || [];
    // Only alert after they've been sitting 2+ hours
    const untouchedFresh = fresh.filter(j => (now - new Date(j.submitted_at)) > 2 * 60 * 60 * 1000);
    if (untouchedFresh.length >= 3) {
        alerts.push(`📥 *${untouchedFresh.length} leads came in today and nobody's touched them.* Get on it.`);
    }

    // 4. Quoted leads going cold — status is "quoted" for 2+ days with no follow-up
    const quotedResult = await supabaseGet(
        `/rest/v1/job_submissions?status=eq.quoted&updated_at=lt.${twoDaysAgo}&select=id,job_number,customer_name,updated_at&order=updated_at.asc&limit=5`
    );
    const coldQuoted = quotedResult.data || [];
    if (coldQuoted.length > 0) {
        const lines = coldQuoted.map(j => {
            const days = Math.round((now - new Date(j.updated_at)) / (24 * 60 * 60 * 1000));
            return `• *${j.job_number}* ${j.customer_name} — quoted ${days} days ago, no follow-up`;
        });
        alerts.push(`💰 *Quoted leads slipping away:*\n${lines.join('\n')}\n_These customers were interested. Close them before they book someone else._`);
    }

    // Post alerts — max 1 message per cron run to avoid spam
    if (alerts.length === 0) return { posted: false, reason: 'nothing_actionable' };

    // Combine into one message, pick the most urgent
    // Priority: overdue callbacks > cold quotes > stale leads > untouched fresh
    const msg = alerts[0]; // Most important alert

    // Don't repeat the same alert within 2 hours
    if (_recentlySent.has(hashMsg(msg))) return { skipped: true, reason: 'already_posted' };

    try {
        const r = await sandyPost(SLACK_CHANNEL, msg);
        await trackSent(msg);
        return { posted: true, type: 'smart_alert', alertCount: alerts.length, ok: r.ok };
    } catch (e) {
        return { posted: false, error: e.message };
    }
}

// ── Sandy's periodic tips (shares knowledge she's built up) ───────────────────

async function shareRandomTip() {
    if (isQuietHours()) return { skipped: true, reason: 'quiet_hours' };
    const allResult = await supabaseGet(
        '/rest/v1/sandy_knowledge?active=eq.true&times_seen=gte.2&confidence=gte.0.7&select=id,category,title,content,times_seen&category=neq.team_member&category=neq.script'
    );
    let items = allResult.data || [];
    // Filter out raw conversation dumps — they contain job numbers, colons (speaker: text), or are too messy
    items = items.filter(item => {
        const c = item.content || '';
        // Skip entries that look like raw Slack conversation text
        if (/[AS]\d{7}/i.test(c)) return false;           // contains job numbers
        if ((c.match(/\w+:/g) || []).length >= 3) return false; // multiple "Name:" patterns = conversation
        if (/otp|caff lead|ALM/i.test(c) && c.length < 80) return false; // short internal jargon
        return true;
    });
    if (!items.length) return null;

    const pick = items[Math.floor(Math.random() * items.length)];

    const intros = [
        "Since nobody asked -",
        "Dropping knowledge.",
        "Pay attention, this actually works:",
        "Been watching. Here's what I noticed:",
        "From the vault:",
        "Quick one from someone who never sleeps:",
        "You're welcome in advance.",
        "Free game:",
        "Something the top closers do:",
        "Heard this work on the floor:",
        "Worth stealing:",
        "Pattern I keep seeing:",
        "This keeps coming up:",
        "Not my first time hearing this one:",
    ];
    const intro = intros[Math.floor(Math.random() * intros.length)];

    const catEmoji = { pricing: '📊', objection: '🛡️', tactic: '💡', competitor: '🔍', process: '📋' };
    const emoji = catEmoji[pick.category] || '🧠';

    const msg = `${emoji} *${intro}*\n${pick.content.slice(0, 250)}`;

    if (_recentlySent.has(hashMsg(msg))) return { skipped: true, reason: 'already_said' };
    try {
        const postResult = await sandyPost(SLACK_CHANNEL, msg);
        await trackSent(msg);
        return { shared: true, category: pick.category, title: pick.title, ok: postResult.ok };
    } catch (e) {
        return { shared: false, error: e.message };
    }
}

// ── Action: knowledge ──────────────────────────────────────────────────────────

async function getKnowledge(category) {
    let path = '/rest/v1/sandy_knowledge?active=eq.true&order=times_seen.desc,last_seen_at.desc';
    if (category) {
        path += `&category=eq.${encodeURIComponent(category)}`;
    }
    const result = await supabaseGet(path);
    return result.data || [];
}

// ── Action: stats ──────────────────────────────────────────────────────────────

async function getStats() {
    const categories = ['pricing', 'objection', 'tactic', 'competitor', 'process', 'team_note'];
    const stats = {};
    let total = 0;

    for (const cat of categories) {
        const result = await supabaseGet(
            `/rest/v1/sandy_knowledge?active=eq.true&category=eq.${cat}&select=id`
        );
        const count = (result.data || []).length;
        stats[cat] = count;
        total += count;
    }

    const processedResult = await supabaseGet(
        '/rest/v1/sandy_processed_messages?select=id'
    );
    stats.total_knowledge = total;
    stats.messages_processed = (processedResult.data || []).length;

    return stats;
}

// ── Wake-up message at 8am EST ────────────────────────────────────────────────

const WAKEUP_MESSAGES = [
    "Rise and grind. Phones aren't gonna answer themselves.",
    "Bad news: you have to work. Good news: I'll be here judging you.",
    "Time to make strangers trust us with everything they own. No big deal.",
    "Coffee up. Leads aren't closing themselves.",
    "Another beautiful day to pretend we're morning people.",
    "Every lead you skip, a competitor books. Just saying.",
    "I've been up all night studying your playbook. Try to impress me.",
    "Today's goal: at least ONE yes. Low bar. Clear it.",
    "Let's see who actually wants to get paid today.",
    "First booking gets bragging rights. Last one gets roasted.",
    "The leaderboard resets every morning. Today could be your day. Probably won't be. But could be.",
    "I ran the numbers overnight. You need more bookings. Groundbreaking analysis, I know.",
    "Phones charged? Headsets on? Excuses off? Good. Let's work.",
    "Somebody's gonna close today. Statistically, it has to happen eventually.",
    "Morning meeting: close more, complain less. Meeting adjourned.",
    "The floor is open. Go make someone's move the best decision they ever made.",
    "Yesterday's stats are yesterday's problem. Fresh slate. Don't waste it.",
    "I see logins but I don't see dials. Fix that.",
    "The only thing standing between you and commission is a phone call. Multiple phone calls. Make them.",
    "Remember: every 'no' gets you closer to a 'yes.' That's either inspiring or depressing depending on your close rate.",
];

async function sendWakeUp() {
    await loadRecentMessages();
    const fresh = WAKEUP_MESSAGES.filter(m => !_recentlySent.has(hashMsg(m)));
    const msg = fresh.length > 0
        ? fresh[Math.floor(Math.random() * fresh.length)]
        : WAKEUP_MESSAGES[Math.floor(Math.random() * WAKEUP_MESSAGES.length)];

    const today = new Date();
    const estNow = new Date(today.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const dateStr = `${estNow.getFullYear()}-${String(estNow.getMonth()+1).padStart(2,'0')}-${String(estNow.getDate()).padStart(2,'0')}`;

    const schedResult = await supabaseGet(
        `/rest/v1/schedule_entries?schedule_date=eq.${dateStr}&status=neq.callout&order=shift_start`
    );
    const entries = Array.isArray(schedResult.data) ? schedResult.data : [];

    let schedText = '';
    if (entries.length > 0) {
        const fmtTime = (t) => {
            if (!t) return '?';
            const [h, m] = t.split(':');
            const hour = parseInt(h);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            return parseInt(m) === 0 ? `${h12}${ampm}` : `${h12}:${m}${ampm}`;
        };
        const names = entries.map(e => {
            const confirmed = e.status === 'confirmed' ? ' ✅' : ' ❓';
            return `* *${e.employee_name}* ${fmtTime(e.shift_start)}-${fmtTime(e.shift_end)}${confirmed}`;
        });
        schedText = `\n\n📅 *Today's lineup:*\n${names.join('\n')}`;
    } else {
        schedText = "\n\n⚠️ *Nobody scheduled today.* Someone needs to step up.";
    }

    const fullMsg = `☀️ ${msg}${schedText}`;
    const result = await sandyPost(SLACK_CHANNEL, fullMsg);
    await trackSent(msg);
    return { posted: true, ok: result.ok, onShift: entries.length };
}

// ── Staffing alert — notify owner when shifts are thin ────────────────────────

// ── Deliver due reminders ─────────────────────────────────────────────────────

async function deliverDueReminders() {
    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayStr = `${estNow.getFullYear()}-${String(estNow.getMonth()+1).padStart(2,'0')}-${String(estNow.getDate()).padStart(2,'0')}`;
    const currentHour = estNow.getHours();
    const currentMin = estNow.getMinutes();
    const currentTimeMin = currentHour * 60 + currentMin;

    // Get pending reminders for today
    const result = await supabaseGet(
        `/rest/v1/sandy_reminders?status=eq.pending&reminder_date=eq.${todayStr}&select=*`
    );
    const reminders = Array.isArray(result.data) ? result.data : [];
    if (!reminders.length) return 0;

    let delivered = 0;
    for (const r of reminders) {
        // Check if it's time (within 30 min window since cron runs every 30 min)
        const [rh, rm] = (r.reminder_time || '09:00').split(':').map(Number);
        const reminderTimeMin = rh * 60 + rm;
        if (currentTimeMin < reminderTimeMin - 5) continue; // Not yet time
        if (currentTimeMin > reminderTimeMin + 35) {
            // Past the window — mark expired
            await supabasePatch(`/rest/v1/sandy_reminders?id=eq.${r.id}`, { status: 'expired' });
            continue;
        }

        // Deliver the reminder
        const msg = `:bell: *Reminder:* ${r.reminder_text}`;
        await sandyPost(SLACK_CHANNEL, msg);
        await trackSent(msg);

        await supabasePatch(`/rest/v1/sandy_reminders?id=eq.${r.id}`, {
            status: 'delivered',
            delivered_at: now.toISOString(),
        });
        delivered++;
    }
    return delivered;
}

async function checkStaffingLevels() {
    const today = new Date();
    const estNow = new Date(today.toLocaleString('en-US', { timeZone: 'America/New_York' }));

    const alerts = [];
    for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
        const checkDate = new Date(estNow);
        checkDate.setDate(checkDate.getDate() + dayOffset);
        const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth()+1).padStart(2,'0')}-${String(checkDate.getDate()).padStart(2,'0')}`;
        const dayLabel = dayOffset === 0 ? 'Today' : 'Tomorrow';

        const result = await supabaseGet(
            `/rest/v1/schedule_entries?schedule_date=eq.${dateStr}&status=neq.callout&select=id,employee_name,shift_start,shift_end,status`
        );
        const entries = Array.isArray(result.data) ? result.data : [];
        const confirmed = entries.filter(e => e.status === 'confirmed');
        const unconfirmed = entries.filter(e => e.status !== 'confirmed');

        if (entries.length === 0) {
            alerts.push({ day: dayLabel, date: dateStr, level: 'critical', count: 0, message: `🚨 *${dayLabel} (${dateStr}):* NOBODY is scheduled. We need coverage ASAP.` });
        } else if (entries.length === 1) {
            alerts.push({ day: dayLabel, date: dateStr, level: 'warning', count: 1, message: `⚠️ *${dayLabel} (${dateStr}):* Only *${entries[0].employee_name}* is scheduled. We need backup.` });
        } else if (unconfirmed.length > 0 && confirmed.length < 2) {
            const names = unconfirmed.map(e => e.employee_name).join(', ');
            alerts.push({ day: dayLabel, date: dateStr, level: 'info', count: entries.length, message: `📋 *${dayLabel} (${dateStr}):* ${entries.length} scheduled but only ${confirmed.length} confirmed. Waiting on: *${names}*` });
        }
    }

    if (alerts.length === 0) return { alerts: [] };

    for (const ownerId of OWNER_SLACK_IDS) {
        try {
            const dmResp = await fetch('https://slack.com/api/conversations.open', {
                method: 'POST',
                headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN || ''}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ users: ownerId })
            });
            const dmData = await dmResp.json();
            if (dmData.ok && dmData.channel) {
                const alertText = `🚨 *Staffing Alert*\n\n${alerts.map(a => a.message).join('\n\n')}`;
                await fetch('https://slack.com/api/chat.postMessage', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN || ''}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channel: dmData.channel.id, text: alertText, mrkdwn: true })
                });
            }
        } catch (e) { /* skip */ }
    }

    const critical = alerts.filter(a => a.level === 'critical' || a.level === 'warning');
    if (critical.length > 0) {
        await sandyPost(SLACK_CHANNEL, critical.map(a => a.message).join('\n'));
    }

    return { alerts };
}

// ── Handler ────────────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        return res.status(200).set(CORS_HEADERS).end();
    }

    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

    const action = req.query.action || req.query.a;

    try {
        if (action === 'learn') {
            const result = await runLearn();
            // Deliver any due reminders
            const remindersDelivered = await deliverDueReminders();
            // Smart alerts — overdue callbacks, stale leads, cold quotes
            const alerts = await runSmartAlerts();
            return res.status(200).json({ ok: true, ...result, remindersDelivered, alerts });
        }

        if (action === 'knowledge') {
            const category = req.query.category || null;
            const data = await getKnowledge(category);
            return res.status(200).json({ ok: true, count: data.length, data });
        }

        if (action === 'stats') {
            const stats = await getStats();
            return res.status(200).json({ ok: true, stats });
        }

        if (action === 'tip') {
            const tip = await shareRandomTip();
            return res.status(200).json({ ok: true, tip });
        }

        if (action === 'post') {
            const text = req.body?.text;
            if (!text) return res.status(400).json({ ok: false, error: 'text is required' });
            const channel = req.body?.channel || SLACK_CHANNEL;
            const result = await sandyPost(channel, text);
            return res.status(200).json({ ok: true, posted: result.ok });
        }

        if (action === 'wakeup') {
            const result = await sendWakeUp();
            return res.status(200).json({ ok: true, ...result });
        }

        if (action === 'staffing') {
            const result = await checkStaffingLevels();
            return res.status(200).json({ ok: true, ...result });
        }

        // One-time cleanup: deactivate old "script" entries and conversation dumps
        if (action === 'cleanup') {
            // Deactivate all script-category entries (old behavior)
            await supabasePatch(
                '/rest/v1/sandy_knowledge?category=eq.script&active=eq.true',
                { active: false }
            );
            // Deactivate objection/tactic entries that contain job numbers (raw conversation dumps)
            const suspects = await supabaseGet(
                '/rest/v1/sandy_knowledge?active=eq.true&select=id,content,category'
            );
            let cleaned = 0;
            if (suspects.data) {
                for (const item of suspects.data) {
                    const c = item.content || '';
                    const isConvoDump = /[AS]\d{7}/i.test(c) || (c.match(/\w+:/g) || []).length >= 3;
                    if (isConvoDump) {
                        await supabasePatch(`/rest/v1/sandy_knowledge?id=eq.${item.id}`, { active: false });
                        cleaned++;
                    }
                }
            }
            return res.status(200).json({ ok: true, scriptsDeactivated: true, conversationDumpsCleaned: cleaned });
        }

        return res.status(400).json({
            ok: false,
            error: 'Missing or invalid action. Use ?action=learn, ?action=knowledge, or ?action=stats',
        });
    } catch (err) {
        console.error('sandy-learn error:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
};
