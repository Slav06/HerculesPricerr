// Vercel serverless function to proxy payment requests to ConvergePay API
// Uses legacy (req, res) format for @vercel/node compatibility

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', method: req.method });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON in request body' });
      }
    }

    const { xmlRequest } = body;
    if (!xmlRequest) {
      return res.status(400).json({ error: 'XML request is required' });
    }

    const https = require('https');
    const querystring = require('querystring');
    const postData = querystring.stringify({ xmldata: xmlRequest });
    const CONVERGEPAY_ENDPOINT = 'https://api.convergepay.com/VirtualMerchant/processxml.do';
    const url = new URL(CONVERGEPAY_ENDPOINT);

    const responseText = await new Promise((resolve, reject) => {
      const request = https.request(
        {
          hostname: url.hostname,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
          }
        },
        (response) => {
          let data = '';
          response.on('data', (chunk) => { data += chunk; });
          response.on('end', () => {
            if (response.statusCode >= 200 && response.statusCode < 300) resolve(data);
            else reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          });
        }
      );
      request.on('error', reject);
      request.write(postData);
      request.end();
    });

    return res.status(200).json({ success: true, xmlResponse: responseText });
  } catch (error) {
    console.error('Error processing payment:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};
