// Payment Service Module for Elavon XML API Integration
// Handles all payment processing operations

class PaymentService {
    constructor() {
        this.config = getPaymentConfig();
        this.isProcessing = false;
    }

    /**
     * Process a payment transaction using Elavon XML API
     * @param {Object} paymentData - Payment information
     * @param {number} paymentData.amount - Transaction amount
     * @param {string} paymentData.cardNumber - Credit card number
     * @param {string} paymentData.expDate - Expiration date (MMYY)
     * @param {string} paymentData.cvv - Security code
     * @param {string} paymentData.firstName - Cardholder first name
     * @param {string} paymentData.lastName - Cardholder last name
     * @param {string} paymentData.transactionType - Type of transaction (sale, auth, etc.)
     * @param {Object} paymentData.billingAddress - Optional billing address
     * @returns {Promise<Object>} - Payment result
     */
    async processPayment(paymentData) {
        if (this.isProcessing) {
            throw new Error('Payment is already being processed');
        }

        this.isProcessing = true;

        try {
            // Validate payment data
            this.validatePaymentData(paymentData);

            // Create XML request
            const xmlRequest = this.createXMLRequest(paymentData);

            // Send request to Elavon
            const response = await this.sendRequest(xmlRequest);

            // Parse response
            const result = this.parseResponse(response);

            // Store transaction record
            await this.storeTransactionRecord(paymentData, result);

            return result;

        } catch (error) {
            console.error('Payment processing error:', error);
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Validate payment data before processing
     */
    validatePaymentData(data) {
        const errors = [];

        if (!data.amount || data.amount <= 0) {
            errors.push('Invalid amount');
        }

        if (!data.cardNumber || !validateCardNumber(data.cardNumber)) {
            errors.push('Invalid card number');
        }

        if (!data.expDate || !/^\d{2}\/\d{2}$/.test(data.expDate)) {
            errors.push('Invalid expiration date (use MM/YY format)');
        }

        if (!data.cvv || data.cvv.length < 3) {
            errors.push('Invalid CVV');
        }

        if (!data.firstName || data.firstName.trim().length < 2) {
            errors.push('Invalid first name');
        }

        if (!data.lastName || data.lastName.trim().length < 2) {
            errors.push('Invalid last name');
        }

        if (!data.transactionType) {
            errors.push('Transaction type is required');
        }

        if (errors.length > 0) {
            throw new Error(`Validation errors: ${errors.join(', ')}`);
        }
    }

    /**
     * Create XML request for Elavon API
     */
    createXMLRequest(data) {
        // Convert amount to cents (Elavon expects amount in cents)
        const amountInCents = Math.round(data.amount * 100);

        // Convert expiration date from MM/YY to MMYY
        const expDate = data.expDate.replace('/', '');

        // Build XML request
        const xml = `
            <txn>
                <ssl_merchant_id>${this.config.MERCHANT_ID}</ssl_merchant_id>
                <ssl_pin>${this.config.PIN}</ssl_pin>
                <ssl_transaction_type>${data.transactionType}</ssl_transaction_type>
                <ssl_amount>${amountInCents}</ssl_amount>
                <ssl_card_number>${data.cardNumber.replace(/\s/g, '')}</ssl_card_number>
                <ssl_exp_date>${expDate}</ssl_exp_date>
                <ssl_cvv2cvc2>${data.cvv}</ssl_cvv2cvc2>
                <ssl_first_name>${data.firstName.trim()}</ssl_first_name>
                <ssl_last_name>${data.lastName.trim()}</ssl_last_name>
                <ssl_currency_code>${PAYMENT_CONFIG.ELAVON.SETTINGS.CURRENCY_CODE}</ssl_currency_code>
                <ssl_show_form>false</ssl_show_form>
                <ssl_result_format>XML</ssl_result_format>
                ${data.billingAddress ? this.createBillingAddressXML(data.billingAddress) : ''}
            </txn>
        `;

        return xml.trim();
    }

    /**
     * Create billing address XML if provided
     */
    createBillingAddressXML(address) {
        return `
            <ssl_avs_address>${address.address || ''}</ssl_avs_address>
            <ssl_avs_zip>${address.zip || ''}</ssl_avs_zip>
            <ssl_avs_city>${address.city || ''}</ssl_avs_city>
            <ssl_avs_state>${address.state || ''}</ssl_avs_state>
            <ssl_avs_country>${address.country || 'US'}</ssl_avs_country>
        `;
    }

    /**
     * Send XML request to Elavon API
     */
    async sendRequest(xmlRequest) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), PAYMENT_CONFIG.ELAVON.SETTINGS.TIMEOUT);

        try {
            const response = await fetch(this.config.ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `xmldata=${encodeURIComponent(xmlRequest)}`,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const responseText = await response.text();
            return responseText;

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Payment request timed out');
            }
            
            throw error;
        }
    }

    /**
     * Parse XML response from Elavon
     */
    parseResponse(responseXML) {
        try {
            // Parse XML response
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(responseXML, 'text/xml');

            // Extract key fields
            const result = {
                success: false,
                transactionId: null,
                authCode: null,
                amount: null,
                cardType: null,
                responseCode: null,
                responseMessage: null,
                rawResponse: responseXML
            };

            // Get basic transaction info
            result.transactionId = this.getXMLValue(xmlDoc, 'ssl_txn_id');
            result.authCode = this.getXMLValue(xmlDoc, 'ssl_approval_code');
            result.amount = this.getXMLValue(xmlDoc, 'ssl_amount');
            result.cardType = this.getXMLValue(xmlDoc, 'ssl_card_type');
            result.responseCode = this.getXMLValue(xmlDoc, 'ssl_result');
            result.responseMessage = this.getXMLValue(xmlDoc, 'ssl_result_message');

            // Determine success based on response code
            // Elavon typically returns '0' for success, non-zero for errors
            result.success = result.responseCode === '0';

            // Convert amount back to dollars if present
            if (result.amount) {
                result.amount = parseFloat(result.amount) / 100;
            }

            return result;

        } catch (error) {
            console.error('Error parsing XML response:', error);
            throw new Error('Invalid response from payment processor');
        }
    }

    /**
     * Extract value from XML document
     */
    getXMLValue(xmlDoc, tagName) {
        const element = xmlDoc.getElementsByTagName(tagName)[0];
        return element ? element.textContent : null;
    }

    /**
     * Store transaction record in database
     * NOTE: Transaction records are now stored via updateJobWithAdditionalPayment in dashboard.html
     * This method is kept for compatibility but does not store to a transactions table (which doesn't exist)
     */
    async storeTransactionRecord(paymentData, result) {
        try {
            // Transaction records are stored in job_submissions.payment_notes and localStorage
            // This method is intentionally left empty to prevent 404 errors from non-existent transactions table
            console.log('📝 Transaction record will be stored by dashboard updateJobWithAdditionalPayment function');
            console.log('💳 Payment processed:', {
                transactionId: result.transactionId,
                amount: paymentData.amount,
                success: result.success
            });
            
            // Don't attempt to store to non-existent transactions table
            // The dashboard will handle storing payment records properly
            
        } catch (error) {
            console.error('Error in storeTransactionRecord:', error);
            // Don't throw error - payment succeeded even if logging failed
        }
    }

    /**
     * Get current user ID from Chrome storage
     */
    getCurrentUserId() {
        // This would be implemented based on your user management system
        return 'current_user_id'; // Placeholder
    }

    /**
     * Process a refund transaction
     */
    async processRefund(transactionId, amount) {
        const refundData = {
            transactionType: 'ccreturn',
            amount: amount,
            cardNumber: '', // Not needed for refunds
            expDate: '', // Not needed for refunds
            cvv: '', // Not needed for refunds
            firstName: '',
            lastName: '',
            originalTransactionId: transactionId
        };

        // Modify XML for refund with original transaction ID
        const xmlRequest = `
            <txn>
                <ssl_merchant_id>${this.config.MERCHANT_ID}</ssl_merchant_id>
                <ssl_pin>${this.config.PIN}</ssl_pin>
                <ssl_transaction_type>ccreturn</ssl_transaction_type>
                <ssl_amount>${Math.round(amount * 100)}</ssl_amount>
                <ssl_txn_id>${transactionId}</ssl_txn_id>
                <ssl_currency_code>${PAYMENT_CONFIG.ELAVON.SETTINGS.CURRENCY_CODE}</ssl_currency_code>
                <ssl_show_form>false</ssl_show_form>
                <ssl_result_format>XML</ssl_result_format>
            </txn>
        `;

        try {
            const response = await this.sendRequest(xmlRequest);
            const result = this.parseResponse(response);
            
            await this.storeTransactionRecord(refundData, result);
            return result;
        } catch (error) {
            console.error('Refund processing error:', error);
            throw error;
        }
    }

    /**
     * Void a transaction (cancel before settlement)
     */
    async voidTransaction(transactionId) {
        const voidData = {
            transactionType: 'ccvoid',
            amount: 0,
            cardNumber: '',
            expDate: '',
            cvv: '',
            firstName: '',
            lastName: '',
            originalTransactionId: transactionId
        };

        const xmlRequest = `
            <txn>
                <ssl_merchant_id>${this.config.MERCHANT_ID}</ssl_merchant_id>
                <ssl_pin>${this.config.PIN}</ssl_pin>
                <ssl_transaction_type>ccvoid</ssl_transaction_type>
                <ssl_txn_id>${transactionId}</ssl_txn_id>
                <ssl_show_form>false</ssl_show_form>
                <ssl_result_format>XML</ssl_result_format>
            </txn>
        `;

        try {
            const response = await this.sendRequest(xmlRequest);
            const result = this.parseResponse(response);
            
            await this.storeTransactionRecord(voidData, result);
            return result;
        } catch (error) {
            console.error('Void processing error:', error);
            throw error;
        }
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentService;
} else {
    // For browser environment
    window.PaymentService = PaymentService;
}

