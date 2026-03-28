// Get Client Agreements API
const SUPABASE_URL = 'process.env.SUPABASE_URL';
const SUPABASE_ANON_KEY = 'process.env.SUPABASE_ANON_KEY';

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function parseToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.substring(7);
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const [userId] = decoded.split(':');
        return userId;
    } catch {
        return null;
    }
}

module.exports = async function handler(req, res) {
    cors(res);
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'GET') {
        res.status(405).json({ success: false, error: 'Method not allowed' });
        return;
    }
    
    try {
        const { email } = req.query || {};
        const authHeader = req.headers.authorization;
        
        // Verify token
        const userId = parseToken(authHeader);
        if (!userId && !email) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        
        // Build query - get agreements by email (customer_email) or user_id
        let queryUrl = `${SUPABASE_URL}/rest/v1/agreements?select=*&order=created_at.desc`;
        
        if (email) {
            queryUrl += `&customer_email=eq.${encodeURIComponent(email.toLowerCase())}`;
        } else if (userId) {
            // If user is logged in, get by user_id
            queryUrl += `&client_user_id=eq.${userId}`;
        } else {
            res.status(400).json({ success: false, error: 'Email or authentication required' });
            return;
        }
        
        const agreementsRes = await fetch(queryUrl, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        if (!agreementsRes.ok) {
            const error = await agreementsRes.text();
            throw new Error(`Failed to fetch agreements: ${error}`);
        }
        
        const agreements = await agreementsRes.json();
        
        // Filter out sensitive data
        const safeAgreements = (agreements || []).map(agreement => ({
            id: agreement.id,
            token: agreement.token,
            job_number: agreement.job_number,
            customer_name: agreement.customer_name,
            agreement_title: agreement.agreement_title,
            status: agreement.status,
            created_at: agreement.created_at,
            signed_at: agreement.signed_at,
            signer_name: agreement.signer_name
        }));
        
        res.json({
            success: true,
            agreements: safeAgreements,
            count: safeAgreements.length
        });
        
    } catch (error) {
        console.error('Get agreements error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to load agreements'
        });
    }
};
