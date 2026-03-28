// Configuration file for Page Price Analyzer Extension
// Update these values with your actual Supabase credentials

const CONFIG = {
    // Supabase Configuration
    SUPABASE: {
        URL: 'process.env.SUPABASE_URL',  // ✅ Your Supabase URL
        ANON_KEY: 'process.env.SUPABASE_ANON_KEY'  // ✅ Your anon key
    },
    
    // Extension Settings
    EXTENSION: {
        NAME: 'Page Price Analyzer',
        VERSION: '1.0.0',
        SOURCE: 'Page Price Analyzer Extension'
    },
    
    // Database Table
    TABLE: {
        JOB_SUBMISSIONS: 'job_submissions'
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    // For browser environment
    window.CONFIG = CONFIG;
}
