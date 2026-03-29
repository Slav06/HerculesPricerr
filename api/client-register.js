// Client Registration API
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Simple bcrypt-like hashing (for production, use proper bcrypt library)
function hashPassword(password) {
    // Simple hash - in production, use bcrypt or similar
    // For now, we'll use a simple approach with crypto
    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
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
        const { email, password, fullName, phone } = req.body || {};
        
        if (!email || !password) {
            res.status(400).json({ success: false, error: 'Email and password are required' });
            return;
        }
        
        if (password.length < 8) {
            res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
            return;
        }
        
        // Check if user already exists
        const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/client_users?email=eq.${encodeURIComponent(email)}&limit=1`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        if (checkRes.ok) {
            const existing = await checkRes.json();
            if (existing && existing.length > 0) {
                res.status(409).json({ success: false, error: 'Email already registered' });
                return;
            }
        }
        
        // Hash password
        const passwordHash = hashPassword(password);
        
        // Create user
        const createRes = await fetch(`${SUPABASE_URL}/rest/v1/client_users`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                email: email.toLowerCase(),
                password_hash: passwordHash,
                full_name: fullName,
                phone: phone || null
            })
        });
        
        if (!createRes.ok) {
            const error = await createRes.text();
            throw new Error(`Failed to create user: ${error}`);
        }
        
        const user = await createRes.json();
        const userId = Array.isArray(user) ? user[0].id : user.id;
        
        // Generate simple token (in production, use JWT)
        const token = Buffer.from(`${userId}:${Date.now()}`).toString('base64');
        
        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            userId,
            token
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Registration failed'
        });
    }
};
