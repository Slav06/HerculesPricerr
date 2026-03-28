// LSA Message Scraper — scrapes Google LSA dashboard for actual message content
// Run: node scraper.js (runs every 2 minutes)
// Run once: node scraper.js --once

const { chromium } = require('playwright');
const path = require('path');

const USER_DATA_DIR = path.join(__dirname, 'google-session-2');
const SUPABASE_URL = 'process.env.SUPABASE_URL';
const SUPABASE_KEY = 'process.env.SUPABASE_ANON_KEY';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const ADMIN_USER_ID = 'U08KU33TNG7';

const LSA_URL = 'https://ads.google.com/localservices/leads';
const INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const RUN_ONCE = process.argv.includes('--once');

let browser = null;
let context = null;

async function main() {
    console.log(`[${timestamp()}] LSA Scraper starting...`);
    console.log(`Mode: ${RUN_ONCE ? 'single run' : 'continuous (every 2 min)'}`);

    context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false,
        viewport: { width: 1280, height: 800 },
        executablePath: process.platform === 'win32'
            ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            : undefined,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--window-position=-2000,-2000'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
    });

    if (RUN_ONCE) {
        await scrapeMessages();
        await context.close();
        process.exit(0);
    }

    // Continuous mode
    await scrapeMessages();
    setInterval(async () => {
        try {
            await scrapeMessages();
        } catch (e) {
            console.error(`[${timestamp()}] Scrape error:`, e.message);
        }
    }, INTERVAL_MS);

    console.log(`[${timestamp()}] Running continuously. Press Ctrl+C to stop.`);
}

async function scrapeMessages() {
    console.log(`[${timestamp()}] Scraping LSA messages...`);

    const page = context.pages()[0] || await context.newPage();

    try {
        // Navigate to leads page
        await page.goto(LSA_URL, { waitUntil: 'networkidle', timeout: 30000 });

        // Check if we're logged in
        const url = page.url();
        if (url.includes('accounts.google.com') || url.includes('signin')) {
            console.log(`[${timestamp()}] Session expired! Run 'node login.js' to re-authenticate.`);
            await sendAdminDM('⚠️ LSA Scraper: Google session expired. Run `node login.js` on your PC to re-authenticate.');
            return;
        }

        // Wait for leads to load
        await page.waitForTimeout(3000);

        // Find message leads (filter to messages only)
        const messageFilter = await page.$('button:has-text("Messages"), [data-filter="messages"], [aria-label*="message"]');
        if (messageFilter) {
            await messageFilter.click();
            await page.waitForTimeout(2000);
        }

        // Scrape each lead conversation
        const leadCards = await page.$$('[data-lead-id], .lead-card, .lead-item, tr[data-id], .conversation-item');
        console.log(`[${timestamp()}] Found ${leadCards.length} lead elements`);

        if (leadCards.length === 0) {
            // Try alternative selectors
            const altCards = await page.$$('div[role="listitem"], div[role="row"], .message-thread');
            console.log(`[${timestamp()}] Alt selectors found ${altCards.length} elements`);

            // Dump page structure for debugging
            const bodyText = await page.evaluate(() => {
                const main = document.querySelector('main') || document.body;
                return main.innerText.substring(0, 500);
            });
            console.log(`[${timestamp()}] Page content preview: ${bodyText.substring(0, 200)}...`);
        }

        // Try to click into each message thread and extract content
        let newMessages = 0;
        const processedLeads = new Set();

        // Get all clickable lead items
        const items = await page.$$('div[role="listitem"], .lead-row, tr.lead, [data-lead-id]');

        for (let i = 0; i < Math.min(items.length, 20); i++) { // Process latest 20
            try {
                const item = items[i];

                // Get lead identifier (phone number or name)
                const itemText = await item.innerText().catch(() => '');

                // Click to open conversation
                await item.click();
                await page.waitForTimeout(1500);

                // Extract messages from the conversation panel
                const messages = await page.evaluate(() => {
                    const msgs = [];
                    // Try various selectors for message bubbles
                    const selectors = [
                        '.message-bubble', '.chat-message', '.conversation-message',
                        '[data-message-id]', '.message-text', '.msg-content',
                        '.message-body', '.conversation-body p', '.lead-message'
                    ];

                    for (const sel of selectors) {
                        const elements = document.querySelectorAll(sel);
                        if (elements.length > 0) {
                            elements.forEach(el => {
                                msgs.push({
                                    text: el.innerText.trim(),
                                    html: el.innerHTML,
                                    className: el.className
                                });
                            });
                            break;
                        }
                    }

                    // If nothing found, try to get any text in the detail panel
                    if (msgs.length === 0) {
                        const detailPanel = document.querySelector('.detail-panel, .conversation-detail, .lead-detail, [role="complementary"]');
                        if (detailPanel) {
                            const paragraphs = detailPanel.querySelectorAll('p, div.text, span.message');
                            paragraphs.forEach(p => {
                                const text = p.innerText.trim();
                                if (text.length > 5 && text.length < 1000) {
                                    msgs.push({ text, className: p.className });
                                }
                            });
                        }
                    }

                    return msgs;
                });

                if (messages.length > 0) {
                    console.log(`[${timestamp()}] Lead ${i}: Found ${messages.length} messages`);

                    // Extract lead ID from URL or page
                    const currentUrl = page.url();
                    const leadIdMatch = currentUrl.match(/lead[_-]?id=(\d+)|leads\/(\d+)/);
                    const leadId = leadIdMatch ? (leadIdMatch[1] || leadIdMatch[2]) : null;

                    if (leadId && !processedLeads.has(leadId)) {
                        processedLeads.add(leadId);

                        // Save to Supabase
                        for (const msg of messages) {
                            await saveScrapedMessage(leadId, msg.text, itemText);
                        }
                        newMessages += messages.length;
                    }
                }
            } catch (e) {
                console.log(`[${timestamp()}] Error processing lead ${i}:`, e.message);
            }
        }

        console.log(`[${timestamp()}] Scrape complete. ${newMessages} new messages found.`);

        if (newMessages > 0) {
            await sendAdminDM(`📬 LSA Scraper found ${newMessages} new message(s). Check /lsa-chat for details.`);
        }

    } catch (e) {
        console.error(`[${timestamp()}] Scrape error:`, e.message);
    }
}

async function saveScrapedMessage(leadId, messageText, leadContext) {
    try {
        // Check if we already have this message
        const checkResp = await fetch(
            `${SUPABASE_URL}/rest/v1/lsa_scraped_messages?lead_id=eq.${leadId}&message_text=eq.${encodeURIComponent(messageText)}&limit=1`,
            { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        );
        const existing = await checkResp.json();
        if (Array.isArray(existing) && existing.length > 0) return; // Already saved

        // Save new message
        await fetch(`${SUPABASE_URL}/rest/v1/lsa_scraped_messages`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal'
            },
            body: JSON.stringify({
                lead_id: leadId,
                message_text: messageText,
                lead_context: leadContext,
                scraped_at: new Date().toISOString()
            })
        });

        console.log(`[${timestamp()}] Saved message for lead ${leadId}: "${messageText.substring(0, 50)}..."`);
    } catch (e) {
        console.error(`[${timestamp()}] Error saving message:`, e.message);
    }
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
    } catch (e) { /* silent */ }
}

function timestamp() {
    return new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log(`\n[${timestamp()}] Shutting down...`);
    if (context) await context.close();
    process.exit(0);
});

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
