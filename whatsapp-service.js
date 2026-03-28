// WhatsApp Service - Handles sending messages to WhatsApp via multiple providers
// Supports: WhatsApp Cloud API (Meta), Twilio, ChatAPI, WANotifier, and custom webhooks

class WhatsAppService {
    constructor(config) {
        this.config = config;
        this.enabled = config.enabled;
        this.provider = config.provider || 'whatsapp-cloud';
        this.recipientNumbers = Array.isArray(config.recipientNumbers) 
            ? config.recipientNumbers 
            : (config.recipientNumbers ? [config.recipientNumbers] : []);
    }

    // Send a message to WhatsApp via the configured provider
    async sendMessage(message, recipientNumbers = null) {
        if (!this.enabled) {
            console.log('🚫 WhatsApp notifications disabled');
            return false;
        }

        const recipients = recipientNumbers || this.recipientNumbers;
        
        if (!recipients || recipients.length === 0) {
            console.warn('⚠️ No WhatsApp recipient numbers configured');
            return false;
        }

        try {
            const results = [];
            
            // Send to all recipients
            for (const recipient of recipients) {
                try {
                    let result;
                    
                    switch (this.provider) {
                        case 'whatsapp-cloud':
                            result = await this.sendViaWhatsAppCloud(recipient, message);
                            break;
                        case 'twilio':
                            result = await this.sendViaTwilio(recipient, message);
                            break;
                        case 'chatapi':
                            result = await this.sendViaChatAPI(recipient, message);
                            break;
                        case 'wanotifier':
                            result = await this.sendViaWANotifier(recipient, message);
                            break;
                        case 'custom':
                            result = await this.sendViaCustom(recipient, message);
                            break;
                        default:
                            console.error(`❌ Unknown provider: ${this.provider}`);
                            results.push({ recipient, success: false, error: 'Unknown provider' });
                            continue;
                    }
                    
                    if (result.success) {
                        console.log(`✅ WhatsApp message sent to ${recipient}:`, result);
                        results.push({ recipient, success: true, result });
                    } else {
                        console.error(`❌ Failed to send WhatsApp message to ${recipient}:`, result.error);
                        results.push({ recipient, success: false, error: result.error });
                    }
                } catch (error) {
                    console.error(`❌ Error sending WhatsApp message to ${recipient}:`, error);
                    results.push({ recipient, success: false, error: error.message });
                }
            }

            // Return true if at least one message was sent successfully
            return results.some(r => r.success);
        } catch (error) {
            console.error('❌ Error in WhatsApp sendMessage:', error);
            return false;
        }
    }

    // Send via WhatsApp Cloud API (Meta) - FREE TIER
    async sendViaWhatsAppCloud(recipient, message) {
        const config = this.config.whatsappCloud;
        
        if (!config.accessToken || !config.phoneNumberId) {
            return { success: false, error: 'WhatsApp Cloud API credentials not configured' };
        }

        // Format recipient (remove whatsapp: prefix if present, ensure it starts with country code)
        const formattedRecipient = recipient.replace(/^whatsapp:/, '').replace(/^\+/, '');

        try {
            const response = await fetch(`/api/send-whatsapp-cloud`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accessToken: config.accessToken,
                    phoneNumberId: config.phoneNumberId,
                    to: formattedRecipient,
                    message: message
                })
            });

            if (response.ok) {
                const result = await response.json();
                return { success: true, result };
            } else {
                const error = await response.text();
                return { success: false, error: error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Send via Twilio
    async sendViaTwilio(recipient, message) {
        const config = this.config.twilio;
        
        if (!config.accountSid || !config.authToken || !config.phoneNumber) {
            return { success: false, error: 'Twilio credentials not configured' };
        }

        try {
            const response = await fetch('/api/send-whatsapp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accountSid: config.accountSid,
                    authToken: config.authToken,
                    from: config.phoneNumber,
                    to: recipient,
                    message: message
                })
            });

            if (response.ok) {
                const result = await response.json();
                return { success: true, result };
            } else {
                const error = await response.text();
                return { success: false, error: error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Send via ChatAPI
    async sendViaChatAPI(recipient, message) {
        const config = this.config.chatapi;
        
        if (!config.instanceId || !config.token) {
            return { success: false, error: 'ChatAPI credentials not configured' };
        }

        try {
            const response = await fetch(`${config.apiUrl}/instance${config.instanceId}/sendMessage?token=${config.token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone: recipient.replace(/^whatsapp:/, '').replace(/^\+/, ''),
                    body: message
                })
            });

            if (response.ok) {
                const result = await response.json();
                return { success: true, result };
            } else {
                const error = await response.text();
                return { success: false, error: error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Send via WANotifier
    async sendViaWANotifier(recipient, message) {
        const config = this.config.wanotifier;
        
        if (!config.apiKey) {
            return { success: false, error: 'WANotifier API key not configured' };
        }

        try {
            const response = await fetch(`${config.apiUrl}/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    to: recipient.replace(/^whatsapp:/, '').replace(/^\+/, ''),
                    message: message
                })
            });

            if (response.ok) {
                const result = await response.json();
                return { success: true, result };
            } else {
                const error = await response.text();
                return { success: false, error: error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Send via custom webhook
    async sendViaCustom(recipient, message) {
        const config = this.config.custom;
        
        if (!config.webhookUrl) {
            return { success: false, error: 'Custom webhook URL not configured' };
        }

        try {
            const body = config.bodyTemplate ? config.bodyTemplate(message, recipient) : {
                to: recipient,
                message: message
            };

            const response = await fetch(config.webhookUrl, {
                method: config.method || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...config.headers
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                const result = await response.json();
                return { success: true, result };
            } else {
                const error = await response.text();
                return { success: false, error: error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Send notification for new job submission
    async notifyNewJob(jobData) {
        if (!this.config.notifyOnSubmission) return false;

        const template = this.config.templates.newJob;
        const message = template.message(jobData);

        return await this.sendMessage(message);
    }

    // Send notification for job booking
    async notifyJobBooked(jobData) {
        if (!this.config.notifyOnBooking) return false;

        const template = this.config.templates.jobBooked;
        const message = template.message(jobData);

        return await this.sendMessage(message);
    }

    // Send notification for payment processed
    async notifyPaymentProcessed(paymentData) {
        if (!this.config.notifyOnPayment) return false;

        const template = this.config.templates.paymentProcessed;
        const message = template.message(paymentData);

        return await this.sendMessage(message);
    }

    // Send notification for booking cancellation
    async notifyBookingCancelled(jobData) {
        if (!this.config.notifyOnCancellation) return false;

        const template = this.config.templates.bookingCancelled;
        const message = template.message(jobData);

        return await this.sendMessage(message);
    }

    // Test WhatsApp connection
    async testConnection() {
        const testMessage = `🧪 *WhatsApp Integration Test*

Job Management System is working!

*Test Time:* ${new Date().toLocaleString()}

If you can see this message, WhatsApp integration is configured correctly.`;

        return await this.sendMessage(testMessage);
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WhatsAppService;
}
