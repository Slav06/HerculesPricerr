// WhatsApp Integration Configuration
// This file contains the configuration for WhatsApp notifications
// Supports multiple providers: Twilio, WhatsApp Cloud API (Meta), ChatAPI, WANotifier

const WHATSAPP_CONFIG = {
    // Provider selection: 'twilio', 'whatsapp-cloud', 'chatapi', 'wanotifier', or 'custom'
    provider: 'whatsapp-cloud', // Change this to your preferred provider
    
    // ============================================
    // OPTION 1: WhatsApp Cloud API (Meta) - FREE TIER
    // ============================================
    // Get these from: https://developers.facebook.com/
    // 1. Create a Meta Business Account
    // 2. Create a WhatsApp Business App
    // 3. Get your Access Token and Phone Number ID
    whatsappCloud: {
        accessToken: '', // Your WhatsApp Cloud API Access Token
        phoneNumberId: '', // Your WhatsApp Business Phone Number ID
        businessAccountId: '', // Your Meta Business Account ID (optional)
        apiVersion: 'v21.0' // WhatsApp API version
    },
    
    // ============================================
    // OPTION 2: Twilio (if you have Twilio account)
    // ============================================
    twilio: {
        accountSid: '', // Your Twilio Account SID
        authToken: '', // Your Twilio Auth Token
        phoneNumber: '' // Your Twilio WhatsApp-enabled phone number (format: whatsapp:+14155238886)
    },
    
    // ============================================
    // OPTION 3: ChatAPI (Alternative provider)
    // ============================================
    // Sign up at: https://app.chat-api.com/
    chatapi: {
        instanceId: '', // Your ChatAPI instance ID
        token: '', // Your ChatAPI token
        apiUrl: 'https://api.chat-api.com' // ChatAPI endpoint
    },
    
    // ============================================
    // OPTION 4: WANotifier (Free tier available)
    // ============================================
    // Sign up at: https://wanotifier.com/
    wanotifier: {
        apiKey: '', // Your WANotifier API key
        apiUrl: 'https://api.wanotifier.com' // WANotifier endpoint
    },
    
    // ============================================
    // OPTION 5: Custom Webhook/API
    // ============================================
    custom: {
        webhookUrl: '', // Your custom webhook URL
        method: 'POST', // HTTP method
        headers: {}, // Custom headers if needed
        bodyTemplate: (message, recipient) => ({
            to: recipient,
            message: message
        })
    },
    
    // Recipient phone numbers (format depends on provider)
    // For WhatsApp Cloud API: Just the number without 'whatsapp:' prefix (e.g., '14155551234')
    // For Twilio: With 'whatsapp:' prefix (e.g., 'whatsapp:+14155551234')
    recipientNumbers: [], // e.g., ['+1234567890', '+0987654321']
    
    // Notification settings
    enabled: false, // Set to true to enable WhatsApp notifications
    notifyOnSubmission: true, // Notify when job is submitted
    notifyOnBooking: true, // Notify when job is booked
    notifyOnPayment: true, // Notify when payment is processed
    notifyOnCancellation: true, // Notify when booking is cancelled
    
    // Message templates
    templates: {
        newJob: {
            emoji: '🚛',
            message: (jobData) => {
                return `🚛 *New Job Submitted*

*Job Number:* ${jobData.jobNumber}
*Customer:* ${jobData.customerName || '-'}
*From:* ${jobData.from || '-'}
*To:* ${jobData.to || '-'}
*Distance:* ${jobData.distance || '-'}
*Pickup Date:* ${jobData.pickupDate || '-'}
*Submitted By:* ${jobData.submittedBy || '-'}
*Cubes:* ${jobData.cubes || '-'}

Job Management System`;
            }
        },
        jobBooked: {
            emoji: '🎉',
            message: (jobData) => {
                return `🎉 *Job Booked!*

*Job Number:* ${jobData.jobNumber}
*Customer:* ${jobData.customerName || '-'}
*Booked By:* ${jobData.bookedBy || '-'}
*Total Deposit:* $${parseFloat(jobData.totalDeposit || 0).toFixed(2)}
*Total Collected:* $${parseFloat(jobData.totalCollected || 0).toFixed(2)}
*Total Binder:* $${parseFloat(jobData.totalBinder || 0).toFixed(2)}

Job Management System`;
            }
        },
        paymentProcessed: {
            emoji: '💳',
            message: (paymentData) => {
                const status = paymentData.success ? '✅ Success' : '❌ Failed';
                return `💳 *Payment ${paymentData.success ? 'Processed' : 'Failed'}*

*Job Number:* ${paymentData.jobNumber}
*Customer:* ${paymentData.customerName}
*Amount:* $${parseFloat(paymentData.amount).toFixed(2)}
*Status:* ${status}
*Transaction ID:* ${paymentData.transactionId || 'N/A'}
*Processed By:* ${paymentData.processedBy}
*Date:* ${new Date(paymentData.processedAt).toLocaleString()}

${paymentData.success ? '' : `*Error:* ${paymentData.responseMessage || 'Unknown error'}`}

Payment Processing System`;
            }
        },
        bookingCancelled: {
            emoji: '❌',
            message: (jobData) => {
                return `❌ *Booking Cancelled*

*Job Number:* ${jobData.jobNumber}
*Customer:* ${jobData.customerName || '-'}
*Cancelled By:* ${jobData.cancelledBy || '-'}
*Status:* Pending

Job Management System`;
            }
        }
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WHATSAPP_CONFIG;
}
