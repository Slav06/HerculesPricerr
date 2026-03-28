// Payment Configuration for Elavon XML API Integration
// Update these values with your actual Elavon credentials

const PAYMENT_CONFIG = {
    // Elavon XML API Configuration
    ELAVON: {
        // Production endpoints
        PRODUCTION: {
            ENDPOINT: 'https://api.convergepay.com/VirtualMerchant/processxml.do',
            MERCHANT_ID: '2346532', // Your production account ID
            PIN: 'WBBFZRCNP6RUS7GYB0FVW49PRAI5DEVFKVJK5P2937VMWX6XOIPSJSQNMTLD583A', // Your production PIN
            USER_ID: 'apiuser999066' // Converge API user
        },
        
        // Sandbox/Demo endpoints for testing
        SANDBOX: {
            ENDPOINT: 'https://api.demo.convergepay.com/VirtualMerchantDemo/processxml.do',
            MERCHANT_ID: 'YOUR_DEMO_MERCHANT_ID', // Replace with your demo merchant ID
            PIN: 'YOUR_DEMO_PIN' // Replace with your demo PIN
        },
        
        // Use sandbox for testing, production for live transactions
        USE_SANDBOX: false, // Set to false for production
        
        // Transaction settings
        SETTINGS: {
            CURRENCY_CODE: 'USD',
            TIMEOUT: 30000, // 30 seconds timeout
            RETRY_ATTEMPTS: 3
        }
    },
    
    // Test card numbers for sandbox testing
    TEST_CARDS: {
        VISA: '4000000000000002',
        MASTERCARD: '5555555555554444',
        AMEX: '378282246310005',
        DISCOVER: '6011111111111117'
    },
    
    // Payment UI Configuration
    UI: {
        SUPPORTED_CARD_TYPES: ['visa', 'mastercard', 'amex', 'discover'],
        MIN_AMOUNT: 0.01,
        MAX_AMOUNT: 99999.99,
        CURRENCY_SYMBOL: '$'
    }
};

// Helper function to get current configuration
function getPaymentConfig() {
    return PAYMENT_CONFIG.ELAVON.USE_SANDBOX ? 
        PAYMENT_CONFIG.ELAVON.SANDBOX : 
        PAYMENT_CONFIG.ELAVON.PRODUCTION;
}

// Helper function to validate card number (basic Luhn algorithm)
function validateCardNumber(cardNumber) {
    const cleaned = cardNumber.replace(/\D/g, '');
    if (cleaned.length < 13 || cleaned.length > 19) return false;
    
    let sum = 0;
    let isEven = false;
    
    for (let i = cleaned.length - 1; i >= 0; i--) {
        let digit = parseInt(cleaned[i]);
        
        if (isEven) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        
        sum += digit;
        isEven = !isEven;
    }
    
    return sum % 10 === 0;
}

// Helper function to detect card type
function detectCardType(cardNumber) {
    const cleaned = cardNumber.replace(/\D/g, '');
    
    if (/^4/.test(cleaned)) return 'visa';
    if (/^5[1-5]/.test(cleaned)) return 'mastercard';
    if (/^3[47]/.test(cleaned)) return 'amex';
    if (/^6(?:011|5)/.test(cleaned)) return 'discover';
    
    return 'unknown';
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PAYMENT_CONFIG, getPaymentConfig, validateCardNumber, detectCardType };
} else {
    // For browser environment
    window.PAYMENT_CONFIG = PAYMENT_CONFIG;
    window.getPaymentConfig = getPaymentConfig;
    window.validateCardNumber = validateCardNumber;
    window.detectCardType = detectCardType;
}

