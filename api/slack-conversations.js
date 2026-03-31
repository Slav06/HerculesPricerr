// Fetch Johnny Boombotz's DM conversations with employees
const { supabaseGet } = require('./_supabase');

const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { name } = req.query;

        // Get all employees or specific one
        let employees = [];
        if (name) {
            const empResult = await supabaseGet(`/rest/v1/employees?name=eq.${encodeURIComponent(name)}&is_active=eq.true`);
            employees = Array.isArray(empResult.data) ? empResult.data : (Array.isArray(empResult) ? empResult : []);
        } else {
            const empResult = await supabaseGet('/rest/v1/employees?is_active=eq.true&order=name');
            employees = Array.isArray(empResult.data) ? empResult.data : (Array.isArray(empResult) ? empResult : []);
        }

        const conversations = [];

        for (const emp of employees) {
            if (!emp.slack_user_id) {
                conversations.push({ name: emp.name, messages: [], error: 'No Slack ID linked' });
                continue;
            }

            // Open/get DM channel
            const dmResp = await fetch('https://slack.com/api/conversations.open', {
                method: 'POST',
                headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ users: emp.slack_user_id })
            });
            const dmData = await dmResp.json();

            if (!dmData.ok || !dmData.channel) {
                conversations.push({ name: emp.name, messages: [], error: 'Could not open DM' });
                continue;
            }

            // Fetch recent messages (last 20)
            const histResp = await fetch(`https://slack.com/api/conversations.history?channel=${dmData.channel.id}&limit=20`, {
                headers: { Authorization: `Bearer ${BOT_TOKEN}` }
            });
            const histData = await histResp.json();

            if (!histData.ok) {
                conversations.push({ name: emp.name, messages: [], error: histData.error });
                continue;
            }

            const messages = (histData.messages || []).reverse().map(m => ({
                text: m.text,
                ts: m.ts,
                time: new Date(parseFloat(m.ts) * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
                isBot: !!m.bot_id,
                user: m.bot_id ? 'Johnny Boombotz' : emp.name
            }));

            conversations.push({ name: emp.name, channelId: dmData.channel.id, messages });
        }

        return res.json(conversations);
    } catch (err) {
        console.error('Slack conversations error:', err);
        return res.status(500).json({ error: err.message });
    }
};
