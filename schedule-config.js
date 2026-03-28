// Schedule System + Slack Bot Configuration

const SCHEDULE_CONFIG = {
    // Slack Bot credentials
    slack: {
        botToken: process.env.SLACK_BOT_TOKEN,
        signingSecret: process.env.SLACK_SIGNING_SECRET,
        clientSecret: process.env.SLACK_CLIENT_SECRET,
        appToken: process.env.SLACK_APP_TOKEN
    },

    // Default shifts
    shifts: {
        morning: { start: '08:00', end: '16:00', label: '8 AM - 4 PM' },
        evening: { start: '15:00', end: '00:00', label: '3 PM - 12 AM' }
    },

    // Default employee schedule
    employees: [
        { name: 'Andrew', shift: 'morning', weekdays: [1,2,3,4,5], weekendRotation: 'A' },
        { name: 'Aubrey', shift: 'morning', weekdays: [1,2,3,4,5], weekendRotation: 'A' },
        { name: 'Michael', shift: 'evening', weekdays: [1,2,3,4,5], weekendRotation: 'B' },
        { name: 'Adrian', shift: 'evening', weekdays: [1,2,3,4,5], weekendRotation: 'B' }
    ],

    // Schedule URL base
    baseUrl: typeof window !== 'undefined' ? window.location.origin : 'https://app.herculesmovingsolutions.com'
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SCHEDULE_CONFIG;
} else {
    window.SCHEDULE_CONFIG = SCHEDULE_CONFIG;
}
