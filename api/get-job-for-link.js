// Return public job info for the add-card link (job number + customer name for display only).
// Use same credentials as dashboard (dashboard.html) so add-card works without env var mismatches
const SUPABASE_URL = 'process.env.SUPABASE_URL';
const SUPABASE_ANON_KEY = 'process.env.SUPABASE_ANON_KEY';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const job = (req.query.job || req.query.job_number || '').trim();
  if (!job) return res.status(400).json({ error: 'Job number is required' });

  try {
    let r = await fetch(
      `${SUPABASE_URL}/rest/v1/job_submissions?select=job_number,customer_name,email&job_number=eq.${encodeURIComponent(job)}&limit=1`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    let bodyText = await r.text();
    // If "email" column doesn't exist, retry without it
    if (!r.ok && (r.status === 400 || r.status === 406)) {
      const lower = bodyText.toLowerCase();
      if (lower.includes('column') && (lower.includes('email') || lower.includes('does not exist'))) {
        r = await fetch(
          `${SUPABASE_URL}/rest/v1/job_submissions?select=job_number,customer_name&job_number=eq.${encodeURIComponent(job)}&limit=1`,
          { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        bodyText = await r.text();
      }
    }
    if (!r.ok) {
      let errMsg = 'Could not load job';
      try {
        const errJson = JSON.parse(bodyText);
        if (errJson.message) errMsg = errJson.message;
        if (errJson.details) errMsg += ': ' + errJson.details;
        if (errJson.code) errMsg += ' (code: ' + errJson.code + ')';
      } catch (_) {}
      console.error('get-job-for-link Supabase error:', r.status, bodyText);
      return res.status(r.status >= 500 ? 500 : 502).json({ error: errMsg });
    }
    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (_) {
      return res.status(500).json({ error: 'Invalid response from database' });
    }
    if (!data || data.length === 0) return res.status(404).json({ error: 'Job not found' });
    const row = data[0];
    return res.status(200).json({
      job_number: row.job_number,
      customer_name: row.customer_name || '',
      customer_email: row.email || null
    });
  } catch (e) {
    console.error('get-job-for-link error:', e);
    return res.status(500).json({ error: 'Internal server error', details: e.message });
  }
};
