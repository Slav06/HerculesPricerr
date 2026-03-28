// Payment Data Encryption Service
// Uses Web Crypto API for secure AES-GCM encryption

class PaymentEncryption {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
        this.ivLength = 12; // 96 bits for GCM
    }

    // Generate a new encryption key (should be stored securely)
    async generateKey() {
        return await window.crypto.subtle.generateKey(
            {
                name: this.algorithm,
                length: this.keyLength
            },
            true, // extractable
            ['encrypt', 'decrypt']
        );
    }

    // Import a key from a base64 string
    async importKey(base64Key) {
        const keyData = this.base64ToArrayBuffer(base64Key);
        return await window.crypto.subtle.importKey(
            'raw',
            keyData,
            {
                name: this.algorithm,
                length: this.keyLength
            },
            false, // not extractable
            ['encrypt', 'decrypt']
        );
    }

    // Export a key to base64 string
    async exportKey(key) {
        const exported = await window.crypto.subtle.exportKey('raw', key);
        return this.arrayBufferToBase64(exported);
    }

    // Encrypt sensitive payment data
    async encryptPaymentData(paymentData, encryptionKey) {
        try {
            const sensitiveFields = {
                cardNumber: paymentData.cardNumber,
                securityCode: paymentData.securityCode,
                // Add other sensitive fields as needed
            };

            const encryptedData = {};

            for (const [field, value] of Object.entries(sensitiveFields)) {
                if (value) {
                    const encrypted = await this.encryptText(value, encryptionKey);
                    encryptedData[`${field}_encrypted`] = encrypted;
                    encryptedData[`${field}_iv`] = encrypted.iv;
                }
            }

            // Return the original data with encrypted sensitive fields
            return {
                ...paymentData,
                ...encryptedData,
                // Remove original sensitive data
                cardNumber: undefined,
                securityCode: undefined
            };

        } catch (error) {
            console.error('❌ Encryption error:', error);
            throw new Error('Failed to encrypt payment data');
        }
    }

    // Decrypt sensitive payment data
    async decryptPaymentData(encryptedData, encryptionKey) {
        try {
            const decryptedData = { ...encryptedData };

            // Decrypt sensitive fields
            const sensitiveFields = ['cardNumber', 'securityCode'];

            for (const field of sensitiveFields) {
                const encryptedField = encryptedData[`${field}_encrypted`];
                const ivField = encryptedData[`${field}_iv`];

                if (encryptedField && ivField) {
                    decryptedData[field] = await this.decryptText(encryptedField, ivField, encryptionKey);
                    // Remove encrypted fields
                    delete decryptedData[`${field}_encrypted`];
                    delete decryptedData[`${field}_iv`];
                }
            }

            return decryptedData;

        } catch (error) {
            console.error('❌ Decryption error:', error);
            throw new Error('Failed to decrypt payment data');
        }
    }

    // Encrypt a text string
    async encryptText(text, key) {
        const iv = window.crypto.getRandomValues(new Uint8Array(this.ivLength));
        const encodedText = new TextEncoder().encode(text);

        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: this.algorithm,
                iv: iv
            },
            key,
            encodedText
        );

        return {
            data: this.arrayBufferToBase64(encrypted),
            iv: this.arrayBufferToBase64(iv)
        };
    }

    // Decrypt a text string
    async decryptText(encryptedData, iv, key) {
        const encryptedBuffer = this.base64ToArrayBuffer(encryptedData);
        const ivBuffer = this.base64ToArrayBuffer(iv);

        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: this.algorithm,
                iv: ivBuffer
            },
            key,
            encryptedBuffer
        );

        return new TextDecoder().decode(decrypted);
    }

    // Utility functions
    base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    // Generate a secure encryption key for your application
    // Store this key securely (environment variables, secure key management, etc.)
    async generateAppKey() {
        const key = await this.generateKey();
        const keyString = await this.exportKey(key);
        console.log('🔑 Generated encryption key (store securely):', keyString);
        return keyString;
    }
}

// Create a singleton instance
const paymentEncryption = new PaymentEncryption();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = paymentEncryption;
} else {
    window.paymentEncryption = paymentEncryption;
}
