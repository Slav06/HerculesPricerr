// Proxy for sending Slack messages from the frontend (avoids CORS)
const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();

    try {
        const { channel, user, text } = req.body;
        if (!text) return res.status(400).json({ error: 'text required' });
        if (!channel && !user) return res.status(400).json({ error: 'channel or user required' });

        let targetChannel = channel;

        // If user is provided, open a DM first
        if (user && !channel) {
            const dmResp = await fetch('https://slack.com/api/conversations.open', {
                method: 'POST',
                headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ users: user })
            });
            const dmData = await dmResp.json();
            if (!dmData.ok || !dmData.channel) {
                return res.json({ ok: false, error: 'Could not open DM: ' + (dmData.error || 'unknown') });
            }
            targetChannel = dmData.channel.id;
        }

        const resp = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: targetChannel, text, mrkdwn: true })
        });
        const result = await resp.json();
        return res.json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
