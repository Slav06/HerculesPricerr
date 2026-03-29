// Vercel serverless function — pulls Elavon transactions and upserts into Supabase transactions table
// Called daily by Vercel cron, or manually via POST /api/sync-elavon-transactions

const https = require('https');
const querystring = require('querystring');

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_KEY     = process.env.SUPABASE_ANON_KEY;
const MERCHANT_ID      = process.env.ELAVON_MERCHANT_ID || '2346532';
const PIN              = process.env.ELAVON_PIN        || 'WBBFZRCNP6RUS7GYB0FVW49PRAI5DEVFKVJK5P2937VMWX6XOIPSJSQNMTLD583A';
const USER_ID          = process.env.ELAVON_USER_ID    || 'apiuser999066';
const ELAVON_ENDPOINT  = 'https://api.convergepay.com/VirtualMerchant/processxml.do';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Default: sync yesterday + today to catch timezone edge cases
    const body = req.body || {};
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);

    const startDate = body.startDate || formatElavonDate(yesterday, false);
    const endDate   = body.endDate   || formatElavonDate(now, true);

    const xml = `<txn><ssl_merchant_id>${MERCHANT_ID}</ssl_merchant_id><ssl_user_id>${USER_ID}</ssl_user_id><ssl_pin>${PIN}</ssl_pin><ssl_transaction_type>txnquery</ssl_transaction_type><ssl_search_start_date>${startDate}</ssl_search_start_date><ssl_search_end_date>${endDate}</ssl_search_end_date></txn>`;

    const postData = querystring.stringify({ xmldata: xml });
    const url = new URL(ELAVON_ENDPOINT);

    const responseText = await new Promise((resolve, reject) => {
      const request = https.request({
        hostname: url.hostname, path: url.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
      }, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(d)); });
      request.on('error', reject);
      request.write(postData); request.end();
    });

    // Check for Elavon error
    const errCode = responseText.match(/<errorCode>([\s\S]*?)<\/errorCode>/);
    if (errCode) {
      const errMsg = responseText.match(/<errorMessage>([\s\S]*?)<\/errorMessage>/);
      return res.status(200).json({ success: false, error: errMsg ? errMsg[1].trim() : `Error ${errCode[1].trim()}` });
    }

    const transactions = parseTransactionXml(responseText);
    if (transactions.length === 0) {
      return res.status(200).json({ success: true, synced: 0, message: 'No transactions in range' });
    }

    // Map Elavon fields → transactions table columns
    const rows = transactions.map(t => ({
      transaction_id:   t.ssl_txn_id,
      amount:           parseFloat(t.ssl_amount || 0),
      refunded_amount:  parseFloat(t.ssl_refunded_amount || 0),
      card_type:        t.ssl_card_short_description || t.ssl_card_type || null,
      card_number:      t.ssl_card_number || null,
      card_last_four:   t.ssl_card_number ? t.ssl_card_number.replace(/\*/g, '').slice(-4) : null,
      exp_date:         t.ssl_exp_date || null,
      transaction_type: t.ssl_transaction_type || null,
      trans_status:     t.ssl_trans_status || null,
      success:          (t.ssl_result_message || '').toUpperCase().includes('APPROV'),
      response_code:    t.ssl_trans_status || null,
      response_message: t.ssl_result_message || null,
      auth_code:        t.ssl_approval_code || null,
      first_name:       t.ssl_first_name || null,
      last_name:        t.ssl_last_name || null,
      user_id:          t.ssl_user_id || null,
      entry_mode:       t.ssl_entry_mode || null,
      avs_response:     t.ssl_avs_response || null,
      cvv2_response:    t.ssl_cvv2_response || null,
      settle_time:      parseElavonDate(t.ssl_settle_time),
      settlement_batch: t.ssl_settlement_batch_response || null,
      processed_at:     parseElavonDate(t.ssl_txn_time),
      synced_at:        new Date().toISOString()
    }));

    // Upsert into Supabase (on_conflict = transaction_id, skip note to preserve existing)
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/transactions?on_conflict=transaction_id`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(rows)
    });

    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      return res.status(200).json({ success: false, error: `Supabase upsert failed: ${errText}` });
    }

    return res.status(200).json({ success: true, synced: rows.length, range: { startDate, endDate } });

  } catch (err) {
    console.error('sync-elavon-transactions error:', err);
    return res.status(200).json({ success: false, error: err.message });
  }
};

function formatElavonDate(date, isEnd) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const y = date.getFullYear();
  return `${m}/${d}/${y} ${isEnd ? '23:59:59' : '00:00:00'}`;
}

function parseElavonDate(str) {
  if (!str) return null;
  try { return new Date(str).toISOString(); } catch { return null; }
}

function parseTransactionXml(xml) {
  const records = [];
  const blockRe = /<txn>([\s\S]*?)<\/txn>/g;
  let block;
  while ((block = blockRe.exec(xml)) !== null) {
    const record = {};
    const fieldRe = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let field;
    while ((field = fieldRe.exec(block[1])) !== null) {
      record[field[1]] = field[2].trim();
    }
    if (Object.keys(record).length > 0) records.push(record);
  }
  return records;
}
