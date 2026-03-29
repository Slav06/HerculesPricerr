// Save card-on-file for a job (customer payment link). Called from add-card.html.
// Stores in payment_captures (same table used for extension captures) so dashboard can charge from one place.

// Use same credentials as dashboard (dashboard.html) so add-card works without env var mismatches
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function cardTypeFromNumber(num) {
  const n = (num || '').replace(/\D/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^5[1-5]/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^6(?:011|5)/.test(n)) return 'Discover';
  return 'Credit';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }

    const { job_number, cardNumber, expDate, cvv, cardholderName, billingAddress } = body || {};
    const job = (job_number || '').trim();
    const card = (cardNumber || '').replace(/\s/g, '');
    const exp = (expDate || '').replace(/\D/g, '');
    const name = (cardholderName || '').trim();

    if (!job) return res.status(400).json({ error: 'Job number is required' });
    if (!card || card.length < 13) return res.status(400).json({ error: 'Valid card number is required' });
    if (!exp || exp.length < 4) return res.status(400).json({ error: 'Expiration (MMYY) is required' });
    if (!name || name.length < 2) return res.status(400).json({ error: 'Cardholder name is required' });
    if (!cvv || String(cvv).length < 3) return res.status(400).json({ error: 'CVV is required' });

    // Resolve job and get customer_name for payment_captures
    const getRes = await fetch(
      `${SUPABASE_URL}/rest/v1/job_submissions?select=id,customer_name&job_number=eq.${encodeURIComponent(job)}&limit=1`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const getBodyText = await getRes.text();
    if (!getRes.ok) {
      let errMsg = 'Could not verify job';
      try {
        const errJson = JSON.parse(getBodyText);
        if (errJson.message) errMsg = errJson.message;
        if (errJson.details) errMsg += ': ' + errJson.details;
      } catch (_) {}
      console.error('save-card job lookup failed:', getRes.status, getBodyText);
      return res.status(500).json({ error: errMsg });
    }
    let rows;
    try {
      rows = JSON.parse(getBodyText);
    } catch (_) {
      return res.status(500).json({ error: 'Invalid response when verifying job' });
    }
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    const customerName = (rows[0].customer_name || '').trim() || 'Customer';

    const lastFour = card.slice(-4);
    const cardType = cardTypeFromNumber(card);
    const expMMYY = exp.length === 4 ? exp : exp.slice(0, 2) + exp.slice(-2);
    const expMonth = expMMYY.slice(0, 2);
    const expYear = expMMYY.slice(2, 4);
    const now = new Date().toISOString();

    // Store in payment_captures (same table dashboard uses to charge)
    const insertPayload = {
      job_number: job,
      customer_name: customerName,
      full_name: name,
      billing_address: billingAddress || null,
      card_number_plain: card,
      security_code_plain: String(cvv),
      card_last_four: lastFour,
      card_type: cardType,
      exp_month: expMonth,
      exp_year: expYear,
      exp_date: expMMYY,
      status: 'card_on_file',
      captured_at: now,
      payment_method: 'Card on file (add-card link)'
    };

    const insertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/payment_captures`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(insertPayload)
      }
    );

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('Save card INSERT failed:', insertRes.status, errText);
      let errMsg = 'Failed to save card';
      try {
        const errJson = JSON.parse(errText);
        if (errJson.message) errMsg = errJson.message;
        if (errJson.details) errMsg += ': ' + errJson.details;
      } catch (_) {}
      return res.status(500).json({ error: errMsg });
    }

    return res.status(200).json({ success: true, message: 'Card saved. You can close this page.' });
  } catch (e) {
    console.error('save-card error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
