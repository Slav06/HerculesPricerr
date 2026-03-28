// Vercel serverless function to send WhatsApp messages via WhatsApp Cloud API (Meta)
// This is the FREE option - no Twilio needed!

const https = require('https');

module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.status(200).end();
        return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { accessToken, phoneNumberId, to, message } = req.body;

        // Validate required fields
        if (!accessToken || !phoneNumberId || !to || !message) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.status(400).json({ 
                error: 'Missing required fields',
                required: ['accessToken', 'phoneNumberId', 'to', 'message']
            });
            return;
        }

        // WhatsApp Cloud API endpoint
        const apiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

        // Prepare request body
        const requestBody = JSON.stringify({
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: {
                body: message
            }
        });

        // Make request to WhatsApp Cloud API
        const options = {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        // Use Node.js https module to make the request
        const whatsappResponse = await new Promise((resolve, reject) => {
            const url = new URL(apiUrl);
            const request = https.request({
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: 'POST',
                headers: options.headers
            }, (response) => {
                let data = '';
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve({ status: response.statusCode, data: parsed });
                    } catch (e) {
                        resolve({ status: response.statusCode, data: data });
                    }
                });
            });

            request.on('error', (error) => {
                reject(error);
            });

            request.write(requestBody);
            request.end();
        });

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        if (whatsappResponse.status >= 200 && whatsappResponse.status < 300) {
            res.status(200).json({
                success: true,
                message: 'WhatsApp message sent successfully',
                messageId: whatsappResponse.data.messages?.[0]?.id || null
            });
        } else {
            res.status(whatsappResponse.status).json({
                success: false,
                error: 'Failed to send WhatsApp message',
                details: whatsappResponse.data
            });
        }

    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
};

