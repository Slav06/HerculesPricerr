# WhatsApp Notification Setup Guide

This guide will help you set up WhatsApp notifications for your Job Management System. **You don't need Twilio!** There are several free and easy options.

## 🎯 Recommended: WhatsApp Cloud API (Meta) - **FREE TIER**

This is the **easiest and free** option. No third-party services needed!

### Step 1: Create a Meta Business Account

1. Go to https://business.facebook.com/
2. Click **Create Account** or sign in
3. Complete the business account setup

### Step 2: Create a WhatsApp Business App

1. Go to https://developers.facebook.com/
2. Click **My Apps** → **Create App**
3. Choose **Business** as the app type
4. Fill in your app details and create the app

### Step 3: Add WhatsApp Product

1. In your app dashboard, click **Add Product**
2. Find **WhatsApp** and click **Set Up**
3. Follow the setup wizard

### Step 4: Get Your Credentials

1. In the WhatsApp section, go to **API Setup**
2. You'll see:
   - **Phone Number ID**: Copy this (looks like: `123456789012345`)
   - **Temporary Access Token**: Copy this (starts with `EAA...`)
   - **Verify Token**: Create one (any string, e.g., `my_verify_token_123`)

### Step 5: Configure in Your System

1. Open `whatsapp-config.js`
2. Set `provider: 'whatsapp-cloud'`
3. Fill in your credentials:

```javascript
const WHATSAPP_CONFIG = {
    provider: 'whatsapp-cloud', // Use WhatsApp Cloud API
    
    whatsappCloud: {
        accessToken: 'EAAxxxxxxxxxxxxxxxxxxxxx', // Your temporary access token
        phoneNumberId: '123456789012345', // Your phone number ID
        apiVersion: 'v21.0'
    },
    
    recipientNumbers: [
        '14155551234', // Phone number with country code (no + or whatsapp: prefix)
        '1234567890'  // Add more recipients
    ],
    
    enabled: true, // Enable notifications
    // ... rest of config
};
```

### Step 6: Get a Permanent Access Token (Recommended)

The temporary token expires in 24 hours. To get a permanent one:

1. Go to **WhatsApp** → **API Setup** in your Meta app
2. Click **Generate Token** (if available)
3. Or use **System User Access Token** for production

**Note**: For production, you'll need to:
- Complete Meta Business verification
- Get your WhatsApp Business Account approved
- Use a permanent access token

### Step 7: Test

1. Deploy your serverless function (`api/send-whatsapp-cloud.js`)
2. Click **💬 Test WhatsApp** in your dashboard
3. Check your WhatsApp for the test message

---

## 🔄 Alternative Options

### Option 2: WANotifier (Free Tier Available)

1. Sign up at https://wanotifier.com/
2. Free plan: 500 contacts, 1,000 broadcasts
3. Get your API key
4. Set `provider: 'wanotifier'` in config
5. Add your API key to `wanotifier.apiKey`

### Option 3: ChatAPI

1. Sign up at https://app.chat-api.com/
2. Create an instance
3. Get your instance ID and token
4. Set `provider: 'chatapi'` in config
5. Add credentials to `chatapi` section

### Option 4: Custom Webhook

If you have your own WhatsApp service or API:

1. Set `provider: 'custom'` in config
2. Add your webhook URL to `custom.webhookUrl`
3. Customize the request format if needed

---

## 📱 Phone Number Format

**For WhatsApp Cloud API:**
- ✅ Correct: `14155551234` (country code + number, no + or whatsapp:)
- ✅ Correct: `1234567890` (if country code is included)
- ❌ Wrong: `+14155551234`
- ❌ Wrong: `whatsapp:+14155551234`

**For other providers:**
- Check each provider's documentation for their format

---

## 🆓 Free Tier Limits

### WhatsApp Cloud API (Meta)
- **Free tier**: 1,000 conversations per month
- After that: Pay per conversation (varies by country)
- See: https://developers.facebook.com/docs/whatsapp/pricing

### WANotifier
- **Free forever**: 500 contacts, 1,000 broadcasts/month
- No credit card required

---

## 🧪 Testing

1. Make sure your serverless function is deployed
2. Open your dashboard
3. Click **💬 Test WhatsApp** button
4. Check your WhatsApp messages

---

## 🔧 Troubleshooting

### "WhatsApp Cloud API credentials not configured"
- Check that `accessToken` and `phoneNumberId` are set in `whatsapp-config.js`
- Make sure `provider: 'whatsapp-cloud'` is set

### "Failed to send WhatsApp message"
- Verify your access token hasn't expired (temporary tokens last 24 hours)
- Check Meta App Dashboard → WhatsApp → API Setup for errors
- Verify recipient phone number format

### "401 Unauthorized"
- Your access token may be expired or invalid
- Generate a new token in Meta App Dashboard

### Messages not received
- Verify recipient phone number is correct
- Check if recipient has WhatsApp
- For WhatsApp Cloud API: Recipient must have messaged you first (or you need to use a template message)

---

## 📚 Resources

- **WhatsApp Cloud API Docs**: https://developers.facebook.com/docs/whatsapp
- **Meta Business**: https://business.facebook.com/
- **Meta Developers**: https://developers.facebook.com/

---

## 🚀 Quick Start (WhatsApp Cloud API)

1. Create Meta Business Account → https://business.facebook.com/
2. Create App → https://developers.facebook.com/
3. Add WhatsApp product
4. Get Phone Number ID and Access Token
5. Update `whatsapp-config.js` with your credentials
6. Set `enabled: true`
7. Deploy and test!

**No Twilio needed!** 🎉
