# GoHighLevel Webhook Setup Guide

This guide will help you set up automatic data syncing from GoHighLevel to your analytics dashboard using webhooks. Once configured, you won't need to manually sync data daily - it will happen automatically!

## What is a Webhook?

A webhook is a way for GoHighLevel to automatically send data to your analytics dashboard whenever events happen (like when a contact is created, updated, or an opportunity changes). This eliminates the need for daily manual syncs.

## Prerequisites

- GoHighLevel account with API access
- Your analytics dashboard deployed (on Vercel or similar)
- Admin access to your dashboard

## Step 1: Get Your Webhook URL

1. Open your analytics dashboard
2. Navigate to the "GoHighLevel Data Sync" section
3. You'll see a "Webhook URL" displayed in the webhook section
4. Click "Copy Webhook URL" to copy it to your clipboard

Your webhook URL will look like:
```
https://your-domain.com/api/ghl-webhook
```

## Step 2: Configure Webhook in GoHighLevel

### Option A: Via GoHighLevel Settings (Recommended)

1. Log in to your GoHighLevel account
2. Navigate to **Settings** → **Integrations** → **Webhooks**
3. Click **"Add Webhook"** or **"Create Webhook"**
4. Enter the following details:
   - **Webhook Name**: Analytics Auto-Sync
   - **Webhook URL**: Paste the URL you copied from your dashboard
   - **Method**: POST
   - **Events to Subscribe**: Select the following events:
     - ✅ `contact.created`
     - ✅ `contact.updated`
     - ✅ `contact.deleted`
     - ✅ `opportunity.created`
     - ✅ `opportunity.updated`
     - ✅ `opportunity.deleted`
     - ✅ `appointment.created`
     - ✅ `appointment.updated`
     - ✅ `appointment.deleted`

5. Click **"Save"** or **"Create Webhook"**

### Option B: Via GoHighLevel API

If you prefer to set up via API, you can use the GoHighLevel API:

```bash
curl -X POST "https://services.leadconnectorhq.com/webhooks/" \
  -H "Authorization: YOUR_API_KEY" \
  -H "Version: 2021-07-28" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/api/ghl-webhook",
    "events": [
      "contact.created",
      "contact.updated",
      "contact.deleted",
      "opportunity.created",
      "opportunity.updated",
      "opportunity.deleted",
      "appointment.created",
      "appointment.updated",
      "appointment.deleted"
    ]
  }'
```

## Step 3: Verify Webhook is Working

1. Go back to your analytics dashboard
2. Click **"Test Webhook"** button
3. You should see: ✅ Webhook endpoint is active and responding!
4. Click **"Check Status"** to see if webhooks are being received
5. Create or update a contact in GoHighLevel
6. Wait a few seconds and click **"Check Status"** again
7. You should see a recent sync timestamp

## Step 4: Monitor Webhook Activity

- The dashboard will show "Last Sync" time for webhook-synced data
- Webhook syncs are marked with "webhook" as the sync source
- You can still perform manual syncs if needed

## Troubleshooting

### Webhook Not Receiving Events

1. **Check Webhook URL**: Make sure the URL is correct and accessible
2. **Test Endpoint**: Use the "Test Webhook" button to verify the endpoint is active
3. **Check GoHighLevel**: Verify the webhook is active in GoHighLevel settings
4. **Check Events**: Make sure you've subscribed to the correct events
5. **Check Logs**: Look for errors in your server logs (Vercel logs)

### Webhook Returns Errors

1. **Check CORS**: The webhook endpoint handles CORS automatically
2. **Check Payload**: GoHighLevel sends data in a specific format - the webhook handles this automatically
3. **Check Database**: Ensure Supabase connection is working

### Manual Sync Still Needed

- Webhooks sync individual events in real-time
- For bulk historical data, you may still want to do a manual sync
- Use the "Manual Sync Data" button for full data refresh

## Supported Events

The webhook currently handles these GoHighLevel events:

- **Contact Events**: `contact.created`, `contact.updated`, `contact.deleted`
- **Opportunity Events**: `opportunity.created`, `opportunity.updated`, `opportunity.deleted`
- **Appointment Events**: `appointment.created`, `appointment.updated`, `appointment.deleted`

## Security Notes

- The webhook endpoint validates incoming requests
- Consider adding webhook signature verification for production use
- Webhook URL is public but requires valid GoHighLevel event format

## Need Help?

If you encounter issues:
1. Check the webhook status in your dashboard
2. Review GoHighLevel webhook logs
3. Check server logs for errors
4. Verify Supabase connection is working

## Benefits of Webhook Auto-Sync

✅ **Real-time Updates**: Data syncs automatically when events happen  
✅ **No Manual Work**: No need to remember daily syncs  
✅ **Always Up-to-Date**: Analytics reflect the latest data  
✅ **Efficient**: Only syncs changed data, not everything  

Enjoy automatic syncing! 🎉
