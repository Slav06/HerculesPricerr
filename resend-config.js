// Resend email configuration (frontend / dashboard)
// API key is NOT stored here — set RESEND_FROM and RESEND_API_KEY in Vercel Environment Variables

const RESEND_CONFIG = {
    enabled: true,

    // Default "from" — override via env RESEND_FROM (e.g. "Your Company <noreply@yourdomain.com>")
    // Using verified domain email for production
    defaultFrom: 'Hercules <quotes@herculesmovingsolutions.com>',

    // Optional: default reply-to
    defaultReplyTo: '',

    // Template IDs (create in Resend Dashboard → Templates, then paste IDs here)
    templates: {
        quote: '',       // e.g. 'd_xxxxxx'
        payment: '',
        booking: '',
        reminder: '',
    },

    // Example template variables (match what you define in Resend dashboard)
    templateVariables: {
        quote: ['CUSTOMER_NAME', 'JOB_NUMBER', 'QUOTE_AMOUNT', 'VALID_UNTIL'],
        payment: ['CUSTOMER_NAME', 'JOB_NUMBER', 'AMOUNT', 'PAYMENT_LINK'],
        booking: ['CUSTOMER_NAME', 'JOB_NUMBER', 'MOVE_DATE', 'DETAILS'],
        reminder: ['CUSTOMER_NAME', 'JOB_NUMBER', 'MESSAGE'],
    },
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RESEND_CONFIG;
}
if (typeof window !== 'undefined') {
    window.RESEND_CONFIG = RESEND_CONFIG;
}
