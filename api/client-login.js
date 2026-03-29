// Client Login API
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function verifyPassword(password, hash) {
    const crypto = require('crypto');
    const [salt, hashValue] = hash.split(':');
    if (!salt || !hashValue) return false;
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return verifyHash === hashValue;
}

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
    cors(res);
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Method not allowed' });
        return;
    }
    
    try {
        const { email, password } = req.body || {};
        
        if (!email || !password) {
            res.status(400).json({ success: false, error: 'Email and password are required' });
            return;
        }
        
        // Find user
        const userRes = await fetch(`${SUPABASE_URL}/rest/v1/client_users?email=eq.${encodeURIComponent(email.toLowerCase())}&limit=1`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        if (!userRes.ok) {
            throw new Error('Failed to query user');
        }
        
        const users = await userRes.json();
        if (!users || users.length === 0) {
            res.status(401).json({ success: false, error: 'Invalid email or password' });
            return;
        }
        
        const user = users[0];
        
        // Verify password
        if (!verifyPassword(password, user.password_hash)) {
            res.status(401).json({ success: false, error: 'Invalid email or password' });
            return;
        }
        
        // Check if account is active
        if (user.is_active === false) {
            res.status(403).json({ success: false, error: 'Account is disabled' });
            return;
        }
        
        // Update last login
        await fetch(`${SUPABASE_URL}/rest/v1/client_users?id=eq.${user.id}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                last_login_at: new Date().toISOString()
            })
        });
        
        // Generate token
        const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
        
        res.json({
            success: true,
            token,
            userId: user.id,
            email: user.email,
            fullName: user.full_name
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Login failed'
        });
    }
};
