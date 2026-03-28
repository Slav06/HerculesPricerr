// Google OAuth - Step 2: Exchange code for tokens
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'https://app.herculesmovingsolutions.com/api/google-auth-callback';

module.exports = async function handler(req, res) {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send('No authorization code received. Go to /api/google-auth to start.');
    }

    try {
        const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });

        const tokens = await tokenResp.json();

        if (tokens.error) {
            return res.status(400).json({ error: tokens.error, description: tokens.error_description });
        }

        // Display the refresh token - save this!
        res.setHeader('Content-Type', 'text/html');
        res.send(`
            <html>
            <body style="font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:40px;max-width:600px;margin:0 auto">
                <h2 style="color:#4ade80">Google OAuth Connected!</h2>
                <p>Save this refresh token — you'll need it for the LSA chat portal:</p>
                <div style="background:#1e293b;padding:16px;border-radius:8px;word-break:break-all;font-family:monospace;font-size:14px;border:1px solid #334155">
                    ${tokens.refresh_token || 'No refresh token returned (you may have already authorized this app before)'}
                </div>
                <br>
                <p style="color:#94a3b8;font-size:13px">Access token (temporary): ${tokens.access_token ? tokens.access_token.substring(0, 30) + '...' : 'none'}</p>
                <p style="color:#94a3b8;font-size:13px">Expires in: ${tokens.expires_in || 'N/A'} seconds</p>
                <br>
                <a href="/lsa-chat" style="background:#3b82f6;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Go to LSA Chat Portal →</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
