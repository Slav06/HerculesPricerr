// Slack Integration Configuration
// This file contains the configuration for Slack webhook notifications

const SLACK_CONFIG = {
    // Webhook URL - Replace with your actual Slack webhook URL
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
    
    // Channel settings - Leave empty to use webhook's default channel
    channel: '', // Empty = use webhook's default channel
    username: 'Job Bot', // Bot username
    icon_emoji: ':truck:', // Bot icon emoji
    
    // Notification settings
    enabled: true, // Set to false to disable Slack notifications
    notifyOnSubmission: true, // Notify when job is submitted
    notifyOnBooking: true, // Notify when job is booked
    notifyOnTransfer: true, // Notify when job is transferred
    
    // Message templates
    templates: {
        newJob: {
            title: '🚛 New Job Submitted',
            color: '#36a64f', // Green
            fields: [
                { title: 'Job Number', value: 'jobNumber', short: true },
                { title: 'Customer', value: 'customerName', short: true },
                { title: 'From', value: 'from', short: true },
                { title: 'To', value: 'to', short: true },
                { title: 'Distance', value: 'distance', short: true },
                { title: 'Pickup Date', value: 'pickupDate', short: true },
                { title: 'Submitted By', value: 'submittedBy', short: true },
                { title: 'Cubes', value: 'cubes', short: true }
            ]
        },
        jobBooked: {
            title: '🎉 Job Booked!',
            color: '#ff6b35', // Orange
            fields: [
                { title: 'Job Number', value: 'jobNumber', short: true },
                { title: 'Customer', value: 'customerName', short: true },
                { title: 'Booked By', value: 'bookedBy', short: true },
                { title: 'Total Deposit', value: 'totalDeposit', short: true },
                { title: 'Total Collected', value: 'totalCollected', short: true },
                { title: 'Total Binder', value: 'totalBinder', short: true }
            ]
        },
        jobTransferred: {
            title: '🔄 Job Transferred',
            color: '#3498db', // Blue
            fields: [
                { title: 'Job Number', value: 'jobNumber', short: true },
                { title: 'Customer', value: 'customerName', short: true },
                { title: 'Transferred To', value: 'transferredTo', short: true },
                { title: 'Transferred By', value: 'transferredBy', short: true }
            ]
        }
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SLACK_CONFIG;
}
