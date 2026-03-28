# Slack Integration Setup Guide

This guide will help you set up Slack notifications for your Job Management System.

## 🚀 Quick Setup

### Step 1: Create a Slack Webhook

1. **Go to your Slack workspace** and navigate to **Apps** → **Browse App Directory**
2. **Search for "Incoming Webhooks"** and install it
3. **Click "Add to Slack"** and choose the channel where you want notifications (e.g., `#job-notifications`)
4. **Copy the webhook URL** - it will look like:
   ```
   YOUR_SLACK_WEBHOOK_URL
   ```

### Step 2: Configure the Webhook URL

#### For Dashboard (dashboard.html):
1. Open `slack-config.js`
2. Replace `YOUR/SLACK/WEBHOOK` with your actual webhook URL:
   ```javascript
   webhookUrl: 'YOUR_SLACK_WEBHOOK_URL',
   ```

#### For Chrome Extension (content.js):
1. Open `content.js`
2. Find the `SLACK_CONFIG` section at the top
3. Replace `YOUR/SLACK/WEBHOOK` with your actual webhook URL:
   ```javascript
   const SLACK_CONFIG = {
       webhookUrl: 'YOUR_SLACK_WEBHOOK_URL',
       // ... rest of config
   };
   ```

### Step 3: Customize Settings (Optional)

#### Channel Settings:
- **Channel**: Change `#job-notifications` to your preferred channel
- **Bot Name**: Change `Job Bot` to your preferred bot name
- **Icon**: Change `:truck:` to any emoji you prefer

#### Notification Types:
You can enable/disable specific notifications:

```javascript
const SLACK_CONFIG = {
    // ... other settings
    notifyOnSubmission: true,  // New job submissions
    notifyOnBooking: true,     // Jobs marked as booked
    notifyOnTransfer: true,    // Jobs transferred to closers
    enabled: true              // Master switch for all notifications
};
```

## 📱 What Notifications You'll Receive

### 🚛 New Job Submitted
- **Trigger**: When a fronter submits a new job via Chrome extension
- **Info**: Job number, customer, locations, distance, pickup date, submitted by
- **Color**: Green

### 🎉 Job Booked
- **Trigger**: When a job is marked as booked in the dashboard
- **Info**: Job number, customer, booked by, deposit, collected, binder amounts
- **Color**: Orange

### 🔄 Job Transferred
- **Trigger**: When a job is assigned to a closer
- **Info**: Job number, customer, transferred to, transferred by
- **Color**: Blue

## 🧪 Testing the Integration

### Test from Dashboard:
1. Open your dashboard
2. Go to browser console (F12)
3. Run: `slackService.testConnection()`
4. Check your Slack channel for the test message

### Test from Chrome Extension:
1. Submit a test job using the extension
2. Check your Slack channel for the notification

## 🔧 Troubleshooting

### Notifications Not Working?

1. **Check Webhook URL**: Make sure it's correct and doesn't contain `YOUR/SLACK/WEBHOOK`
2. **Check Browser Console**: Look for error messages
3. **Check Slack Channel**: Make sure the bot has permission to post
4. **Check Network**: Ensure your network allows webhook calls

### Common Issues:

**"Slack notifications disabled"**
- Set `enabled: true` in the config

**"Failed to send Slack notification"**
- Check webhook URL is correct
- Verify channel name is correct (include # for channels)

**"403 Forbidden"**
- Webhook URL might be expired or invalid
- Create a new webhook

## 🔒 Security Notes

- **Keep webhook URLs private** - don't commit them to public repositories
- **Use environment variables** for production deployments
- **Rotate webhook URLs** periodically for security

## 📋 Configuration Files

- `slack-config.js` - Dashboard configuration
- `slack-service.js` - Dashboard Slack service
- `content.js` - Chrome extension configuration (top of file)

## 🎨 Customizing Messages

You can customize the message templates in `slack-config.js`:

```javascript
templates: {
    newJob: {
        title: '🚛 New Job Submitted',
        color: '#36a64f', // Green
        fields: [
            // Add or remove fields as needed
        ]
    }
}
```

## 🚀 Advanced Features

### Custom Channels per Event:
```javascript
channels: {
    newJob: '#new-jobs',
    booking: '#bookings',
    transfer: '#transfers'
}
```

### Rich Formatting:
The system supports Slack's rich formatting including:
- Colors
- Fields
- Links
- Timestamps
- Emojis

---

**Need Help?** Check the browser console for detailed error messages or contact your system administrator.
