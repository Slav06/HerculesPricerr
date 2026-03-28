// Email service — sends email via Resend API (api/send-email.js)
// API key is used server-side only (Vercel RESEND_API_KEY).

class EmailService {
    constructor(options = {}) {
        this.apiPath = options.apiPath || '/api/send-email';
        this.defaultFrom = options.defaultFrom || (typeof RESEND_CONFIG !== 'undefined' && RESEND_CONFIG.defaultFrom) || 'Hercules <onboarding@resend.dev>';
        this.defaultReplyTo = options.defaultReplyTo || (typeof RESEND_CONFIG !== 'undefined' && RESEND_CONFIG.defaultReplyTo) || '';
        this.enabled = options.enabled !== false && (typeof RESEND_CONFIG === 'undefined' || RESEND_CONFIG.enabled);
    }

    /**
     * Send a plain email (subject + html or text).
     * @param {string|string[]} to - Recipient(s)
     * @param {string} subject - Subject line
     * @param {object} options - { html, text, from, replyTo }
     * @returns {Promise<{ success: boolean, id?: string, error?: string }>}
     */
    async send(to, subject, options = {}) {
        if (!this.enabled) {
            return { success: false, error: 'Email is disabled' };
        }

        const body = {
            to,
            subject,
            from: options.from || this.defaultFrom,
            replyTo: options.replyTo || this.defaultReplyTo || undefined,
        };
        if (options.html) body.html = options.html;
        if (options.text) body.text = options.text;
        if (options.meta) body.meta = options.meta;

        return this._request(body);
    }

    /**
     * Send an email using a Resend template.
     * @param {string|string[]} to - Recipient(s)
     * @param {string} templateId - Resend template ID (Dashboard → Templates)
     * @param {object} variables - Template variables (e.g. { CUSTOMER_NAME: 'John', JOB_NUMBER: '123' })
     * @param {object} options - { from, replyTo }
     * @returns {Promise<{ success: boolean, id?: string, error?: string }>}
     */
    async sendTemplate(to, templateId, variables = {}, options = {}) {
        if (!this.enabled) {
            return { success: false, error: 'Email is disabled' };
        }

        const body = {
            to,
            templateId,
            templateVariables: variables,
            from: options.from || this.defaultFrom,
            replyTo: options.replyTo || this.defaultReplyTo || undefined,
        };

        return this._request(body);
    }

    /**
     * Convenience: send quote email (uses template if configured).
     */
    async sendQuote(to, { customerName, jobNumber, quoteAmount, validUntil, html }) {
        const templateId = typeof RESEND_CONFIG !== 'undefined' && RESEND_CONFIG.templates && RESEND_CONFIG.templates.quote;
        if (templateId) {
            return this.sendTemplate(to, templateId, {
                CUSTOMER_NAME: customerName,
                JOB_NUMBER: jobNumber,
                QUOTE_AMOUNT: quoteAmount,
                VALID_UNTIL: validUntil,
            });
        }
        return this.send(to, `Quote #${jobNumber} – ${quoteAmount}`, {
            html: html || `Hi ${customerName},<br><br>Your quote for job #${jobNumber}: $${quoteAmount}. Valid until ${validUntil}.<br><br>Best regards`,
        });
    }

    /**
     * Create an agreement link for a job.
     * @param {string} jobSubmissionId - Job submission ID (UUID)
     * @param {string} jobNumber - Job number (alternative to jobSubmissionId)
     * @param {string} customerEmail - Optional customer email
     * @returns {Promise<{ success: boolean, link?: string, token?: string, agreementId?: string, error?: string }>}
     */
    async createAgreementLink(jobSubmissionId, jobNumber, customerEmail) {
        try {
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/api/create-agreement`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobSubmissionId, jobNumber, customerEmail }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errorMsg = data.error || data.message || response.statusText;
                const details = data.details ? ` Details: ${JSON.stringify(data.details)}` : '';
                return { success: false, error: errorMsg + details };
            }
            return { success: true, link: data.link, token: data.token, agreementId: data.agreementId };
        } catch (err) {
            return { success: false, error: err.message || 'Network error' };
        }
    }

    /**
     * Send email with agreement link (creates agreement + sends email).
     * @param {string|string[]} to - Recipient(s)
     * @param {string} subject - Subject line
     * @param {string} htmlBody - HTML body (use {{AGREEMENT_LINK}} placeholder)
     * @param {object} agreementInfo - { jobSubmissionId, jobNumber, customerEmail }
     * @param {object} options - { from, replyTo }
     * @returns {Promise<{ success: boolean, agreementLink?: string, emailId?: string, error?: string }>}
     */
    async sendWithAgreement(to, subject, htmlBody, agreementInfo, options = {}) {
        const { jobSubmissionId, jobNumber, customerEmail } = agreementInfo || {};
        if (!jobSubmissionId && !jobNumber) {
            return { success: false, error: 'Provide jobSubmissionId or jobNumber' };
        }

        const agreementResult = await this.createAgreementLink(jobSubmissionId, jobNumber, customerEmail);
        if (!agreementResult.success) {
            return agreementResult;
        }

        const html = htmlBody.replace(/\{\{AGREEMENT_LINK\}\}/g, agreementResult.link);
        const sendResult = await this.send(to, subject, {
            ...options,
            html,
            meta: {
                jobSubmissionId,
                agreementId: agreementResult.agreementId,
                agreementToken: agreementResult.token,
            },
        });

        if (!sendResult.success) {
            return sendResult;
        }

        return {
            success: true,
            agreementLink: agreementResult.link,
            emailId: sendResult.id,
        };
    }

    /**
     * Convenience: send payment link/reminder.
     */
    async sendPayment(to, { customerName, jobNumber, amount, paymentLink, html }) {
        const templateId = typeof RESEND_CONFIG !== 'undefined' && RESEND_CONFIG.templates && RESEND_CONFIG.templates.payment;
        if (templateId) {
            return this.sendTemplate(to, templateId, {
                CUSTOMER_NAME: customerName,
                JOB_NUMBER: jobNumber,
                AMOUNT: amount,
                PAYMENT_LINK: paymentLink,
            });
        }
        return this.send(to, `Payment for job #${jobNumber}`, {
            html: html || `Hi ${customerName},<br><br>Amount due for job #${jobNumber}: $${amount}.<br><a href="${paymentLink}">Pay now</a><br><br>Best regards`,
        });
    }

    async _request(body) {
        try {
            const response = await fetch(this.apiPath, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                return { success: false, error: data.error || data.message || response.statusText };
            }
            return { success: true, id: data.id };
        } catch (err) {
            return { success: false, error: err.message || 'Network error' };
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmailService;
}
if (typeof window !== 'undefined') {
    window.EmailService = EmailService;
}
