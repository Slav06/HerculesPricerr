// Vercel serverless function to send WhatsApp messages via Twilio
// This function acts as a proxy to avoid exposing Twilio credentials in the frontend

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
        const { accountSid, authToken, from, to, message } = req.body;

        // Validate required fields
        if (!accountSid || !authToken || !from || !to || !message) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.status(400).json({ 
                error: 'Missing required fields',
                required: ['accountSid', 'authToken', 'from', 'to', 'message']
            });
            return;
        }

        // Twilio API endpoint for sending WhatsApp messages
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

        // Create Basic Auth header
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

        // Prepare form data
        const formData = new URLSearchParams({
            From: from,
            To: to,
            Body: message
        });

        // Make request to Twilio API
        const options = {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': formData.toString().length
            }
        };

        // Use Node.js https module to make the request
        const twilioResponse = await new Promise((resolve, reject) => {
            const request = https.request(twilioUrl, options, (response) => {
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

            request.write(formData.toString());
            request.end();
        });

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        if (twilioResponse.status >= 200 && twilioResponse.status < 300) {
            res.status(200).json({
                success: true,
                message: 'WhatsApp message sent successfully',
                sid: twilioResponse.data.sid || null
            });
        } else {
            res.status(twilioResponse.status).json({
                success: false,
                error: 'Failed to send WhatsApp message',
                details: twilioResponse.data
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

