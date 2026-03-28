// Slack Service - Handles sending messages to Slack via webhooks
// This file contains functions to send notifications to Slack channels

class SlackService {
    constructor(config) {
        this.config = config;
        this.webhookUrl = config.webhookUrl;
        this.channel = config.channel;
        this.username = config.username;
        this.icon_emoji = config.icon_emoji;
    }

    // Send a message to Slack
    async sendMessage(message) {
        if (!this.config.enabled || !this.webhookUrl || this.webhookUrl.includes('YOUR/SLACK/WEBHOOK')) {
            console.log('🚫 Slack notifications disabled or webhook not configured');
            return false;
        }

        try {
            const payload = {
                username: this.username,
                icon_emoji: this.icon_emoji,
                ...message
            };

            // Only add channel if it's specified
            if (this.channel && this.channel.trim() !== '') {
                payload.channel = this.channel;
            }

            console.log('📤 Sending Slack payload:', JSON.stringify(payload, null, 2));

            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log('✅ Slack notification sent successfully');
                return true;
            } else {
                const errorText = await response.text();
                console.error('❌ Failed to send Slack notification:', response.status, response.statusText);
                console.error('❌ Error details:', errorText);
                return false;
            }
        } catch (error) {
            console.error('❌ Error sending Slack notification:', error);
            return false;
        }
    }

    // Send notification for new job submission
    async notifyNewJob(jobData) {
        if (!this.config.notifyOnSubmission) return false;

        const template = this.config.templates.newJob;
        const fields = template.fields.map(field => ({
            title: field.title,
            value: this.formatValue(jobData[field.value], field.value),
            short: field.short
        }));

        const message = {
            text: `${template.title} - ${jobData.jobNumber}`,
            attachments: [{
                color: template.color,
                title: template.title,
                title_link: jobData.pageUrl || '#',
                fields: fields,
                footer: 'Job Management System',
                ts: Math.floor(Date.now() / 1000)
            }]
        };

        return await this.sendMessage(message);
    }

    // Send notification for job booking
    async notifyJobBooked(jobData) {
        if (!this.config.notifyOnBooking) return false;

        const template = this.config.templates.jobBooked;
        const fields = template.fields.map(field => ({
            title: field.title,
            value: this.formatValue(jobData[field.value], field.value),
            short: field.short
        }));

        const message = {
            text: `${template.title} - ${jobData.jobNumber}`,
            attachments: [{
                color: template.color,
                title: template.title,
                title_link: jobData.pageUrl || '#',
                fields: fields,
                footer: 'Job Management System',
                ts: Math.floor(Date.now() / 1000)
            }]
        };

        return await this.sendMessage(message);
    }

    // Send notification for job transfer
    async notifyJobTransferred(jobData) {
        if (!this.config.notifyOnTransfer) return false;

        const template = this.config.templates.jobTransferred;
        const fields = template.fields.map(field => ({
            title: field.title,
            value: this.formatValue(jobData[field.value], field.value),
            short: field.short
        }));

        const message = {
            text: `${template.title} - ${jobData.jobNumber}`,
            attachments: [{
                color: template.color,
                title: template.title,
                title_link: jobData.pageUrl || '#',
                fields: fields,
                footer: 'Job Management System',
                ts: Math.floor(Date.now() / 1000)
            }]
        };

        return await this.sendMessage(message);
    }

    // Send notification for booking cancellation
    async notifyBookingCancelled(jobData) {
        const message = {
            text: `❌ Booking Cancelled - ${jobData.jobNumber}`,
            attachments: [{
                color: '#dc3545', // Red
                title: '❌ Booking Cancelled',
                title_link: jobData.pageUrl || '#',
                fields: [
                    { title: 'Job Number', value: jobData.jobNumber, short: true },
                    { title: 'Customer', value: jobData.customerName, short: true },
                    { title: 'Cancelled By', value: jobData.cancelledBy, short: true },
                    { title: 'Status', value: 'Pending', short: true }
                ],
                footer: 'Job Management System',
                ts: Math.floor(Date.now() / 1000)
            }]
        };

        return await this.sendMessage(message);
    }

    // Send notification for follow-up added by closer
    async notifyFollowUpAdded(jobData) {
        const message = {
            text: `📞 Follow-up Added - ${jobData.jobNumber}`,
            attachments: [{
                color: '#17a2b8', // Blue
                title: '📞 Follow-up Added by Closer',
                title_link: jobData.pageUrl || '#',
                fields: [
                    { title: 'Job Number', value: jobData.jobNumber, short: true },
                    { title: 'Customer', value: jobData.customerName, short: true },
                    { title: 'Added By', value: jobData.addedBy, short: true },
                    { title: 'Notes', value: jobData.notes, short: false },
                    { title: 'Callback Scheduled', value: jobData.callbackDate, short: true }
                ],
                footer: 'Job Management System',
                ts: Math.floor(Date.now() / 1000)
            }]
        };

        return await this.sendMessage(message);
    }

    // Format values for Slack display
    formatValue(value, fieldName) {
        if (value === null || value === undefined || value === '') {
            return '-';
        }

        switch (fieldName) {
            case 'totalDeposit':
            case 'totalCollected':
            case 'totalBinder':
                return `$${parseFloat(value).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            case 'pickupDate':
                return new Date(value).toLocaleDateString();
            default:
                return String(value);
        }
    }

    // Test Slack connection
    async testConnection() {
        const testMessage = {
            text: '🧪 Slack integration test - Job Management System is working!',
            attachments: [{
                color: '#36a64f',
                title: 'Integration Test',
                text: 'If you can see this message, Slack integration is working correctly.',
                footer: 'Job Management System',
                ts: Math.floor(Date.now() / 1000)
            }]
        };

        return await this.sendMessage(testMessage);
    }

    async notifyPaymentProcessed(paymentData) {
        const { jobNumber, customerName, amount, transactionId, authCode, cardLastFour, processedBy, processedAt, success, responseMessage, responseCode, rawResponse, debugApiUrl, debugPageUrl, debugOrigin, debugResponseCode } = paymentData;
        
        const formattedAmount = `$${parseFloat(amount).toFixed(2)}`;
        const formattedDate = new Date(processedAt).toLocaleString();
        
        // Determine status and color based on success
        const statusText = success ? '💳 Payment Processed Successfully' : '❌ Payment Processing Failed';
        const statusColor = success ? '#28a745' : '#dc3545';
        const titleText = success ? `Payment Confirmation - Job ${jobNumber}` : `Payment Failed - Job ${jobNumber}`;
        
        const fields = [
            { title: 'Customer', value: customerName, short: true },
            { title: 'Job Number', value: jobNumber, short: true },
            { title: 'Amount', value: formattedAmount, short: true },
            { title: 'Processed By', value: processedBy, short: true },
            { title: 'API Response', value: success ? `✅ ${responseMessage || 'Success'}` : `❌ ${responseMessage || 'Failed'}`, short: false },
            { title: 'Date & Time', value: formattedDate, short: true }
        ];
        
        // Add debug fields for failed payments
        if (!success) {
            if (debugApiUrl) fields.push({ title: '🔧 API URL Called', value: debugApiUrl, short: false });
            if (debugPageUrl) fields.push({ title: '🔧 Page URL', value: debugPageUrl, short: false });
            if (debugOrigin) fields.push({ title: '🔧 Origin', value: debugOrigin, short: true });
            if (debugResponseCode) fields.push({ title: '🔧 Response Code', value: String(debugResponseCode), short: true });
            if (rawResponse && rawResponse.length < 300) fields.push({ title: '🔧 Raw Error', value: rawResponse, short: false });
            else if (responseMessage && responseMessage.length > 100) fields.push({ title: '🔧 Full Error', value: responseMessage.substring(0, 500) + (responseMessage.length > 500 ? '...' : ''), short: false });
        }
        
        const message = {
            text: statusText,
            attachments: [{
                color: statusColor,
                title: titleText,
                fields: fields,
                footer: 'Payment Processing System',
                ts: Math.floor(Date.now() / 1000)
            }]
        };

        console.log('📤 Sending payment notification to Slack:', message);
        return await this.sendMessage(message);
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SlackService;
}
