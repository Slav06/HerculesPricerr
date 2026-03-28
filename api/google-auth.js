// Google OAuth - Step 1: Redirect to Google consent screen
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const REDIRECT_URI = 'https://app.herculesmovingsolutions.com/api/google-auth-callback';

module.exports = async function handler(req, res) {
    const scopes = 'https://www.googleapis.com/auth/adwords';

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&access_type=offline` +
        `&prompt=consent`;

    res.writeHead(302, { Location: authUrl });
    res.end();
};
