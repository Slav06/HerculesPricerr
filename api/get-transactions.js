// Vercel serverless function — queries Elavon ConvergePay for transaction history
// Uses txnquery action: https://developer.elavon.com/products/xml-api/v1/overview

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let responseText = '';

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }

    const { startDate, endDate } = body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const MERCHANT_ID = process.env.ELAVON_MERCHANT_ID || '2346532';
    const PIN        = process.env.ELAVON_PIN        || 'WBBFZRCNP6RUS7GYB0FVW49PRAI5DEVFKVJK5P2937VMWX6XOIPSJSQNMTLD583A';
    const USER_ID    = process.env.ELAVON_USER_ID    || 'apiuser999066';
    const ENDPOINT   = 'https://api.convergepay.com/VirtualMerchant/processxml.do';

    const xml = `<txn><ssl_merchant_id>${MERCHANT_ID}</ssl_merchant_id><ssl_user_id>${USER_ID}</ssl_user_id><ssl_pin>${PIN}</ssl_pin><ssl_transaction_type>txnquery</ssl_transaction_type><ssl_search_start_date>${startDate}</ssl_search_start_date><ssl_search_end_date>${endDate}</ssl_search_end_date></txn>`;

    const https = require('https');
    const querystring = require('querystring');
    const postData = querystring.stringify({ xmldata: xml });
    const url = new URL(ENDPOINT);

    responseText = await new Promise((resolve, reject) => {
      const request = https.request({
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (response) => {
        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => resolve(data));
      });
      request.on('error', reject);
      request.write(postData);
      request.end();
    });

    // Check for Elavon-level error codes first
    const errCode = responseText.match(/<errorCode>([\s\S]*?)<\/errorCode>/);
    const errMsg  = responseText.match(/<errorMessage>([\s\S]*?)<\/errorMessage>/);
    if (errCode) {
      return res.status(200).json({
        success: false,
        error: errMsg ? errMsg[1].trim() : `Elavon error ${errCode[1].trim()}`,
        raw: responseText
      });
    }

    const transactions = parseTransactionXml(responseText);
    return res.status(200).json({ success: true, transactions, raw: responseText });

  } catch (error) {
    console.error('get-transactions error:', error);
    return res.status(200).json({
      success: false,
      error: error.message || 'Unknown error',
      raw: responseText
    });
  }
};

function parseTransactionXml(xml) {
  const records = [];
  // Elavon wraps each transaction in <txn> blocks inside <txnlist>
  const blockRe = /<txn>([\s\S]*?)<\/txn>/g;
  let block;
  while ((block = blockRe.exec(xml)) !== null) {
    const content = block[1];
    const record = {};
    const fieldRe = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let field;
    while ((field = fieldRe.exec(content)) !== null) {
      record[field[1]] = field[2].trim();
    }
    if (Object.keys(record).length > 0) records.push(record);
  }
  return records;
}
