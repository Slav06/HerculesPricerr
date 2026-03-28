// Payment Fields Test Script
console.log('💳 Payment Fields Test Script Loaded');

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    console.log('💳 Payment Fields Test Page Loaded');
    console.log('Available test functions:');
    console.log('- simulateFieldExtraction()');
    console.log('- testProcessingLogic()');
    console.log('- generateJSON()');
    console.log('- updateDashboardPreview()');
    
    // Check for captured data from HelloMoving page
    loadCapturedData();
    
    // Listen for incoming payment data
    setupMessageListener();
});

// Setup message listener for incoming payment data
function setupMessageListener() {
    // Update status to show we're ready
    updateConnectionStatus('🟢', 'Ready to receive payment data');
    
    window.addEventListener('message', function(event) {
        console.log('📨 Received message:', event.data);
        
        if (event.data && event.data.type === 'PAYMENT_DATA_SUBMISSION') {
            console.log('✅ Received payment data submission:', event.data.data);
            
            // Update status to show data received
            updateConnectionStatus('✅', 'Payment data received!');
            
            // Update the page with the received data
            updatePageWithCapturedData(event.data.data);
            
            // Show notification
            showReceivedDataNotification(event.data.data);
            
            // Store the data for persistence
            localStorage.setItem('capturedPaymentData', JSON.stringify(event.data.data));
        }
    });
    
    console.log('👂 Message listener setup complete - ready to receive payment data');
}

// Update connection status indicator
function updateConnectionStatus(icon, text) {
    const statusIcon = document.getElementById('statusIcon');
    const statusText = document.getElementById('statusText');
    
    if (statusIcon) statusIcon.textContent = icon;
    if (statusText) statusText.textContent = text;
    
    console.log(`📡 Status updated: ${icon} ${text}`);
}

// Show notification when data is received
function showReceivedDataNotification(data) {
    // Create notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        color: white;
        padding: 20px 30px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(40, 167, 69, 0.3);
        z-index: 100000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-weight: 600;
        font-size: 16px;
        max-width: 500px;
        text-align: center;
        border: 2px solid rgba(255, 255, 255, 0.2);
        animation: slideInDown 0.5s ease-out;
    `;

    notification.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
            <span style="font-size: 24px;">📨</span>
            <div>
                <div style="font-weight: 600; font-size: 18px;">Payment Data Received!</div>
                <div style="font-size: 14px; opacity: 0.9; margin-top: 5px;">
                    Job: <strong>${data.jobNumber}</strong> | Customer: <strong>${data.fullName || 'Unknown'}</strong>
                </div>
                <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">
                    Received at: ${new Date().toLocaleString()}
                </div>
            </div>
        </div>
    `;

    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInDown {
            from {
                transform: translateX(-50%) translateY(-100%);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Auto-remove after 6 seconds
    setTimeout(() => {
        notification.style.animation = 'slideInDown 0.5s ease-out reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 500);
    }, 6000);
}

// Load captured data from localStorage
function loadCapturedData() {
    try {
        const capturedData = localStorage.getItem('capturedPaymentData');
        if (capturedData) {
            const data = JSON.parse(capturedData);
            console.log('📋 Loaded captured data from HelloMoving:', data);
            
            // Update the page with real captured data
            updatePageWithCapturedData(data);
            
            // Show notification
            showCapturedDataNotification(data);
        } else {
            console.log('ℹ️ No captured data found - using demo data');
        }
    } catch (error) {
        console.error('❌ Error loading captured data:', error);
    }
}

// Update page with captured data
function updatePageWithCapturedData(data) {
    console.log('🔄 Updating page with captured data:', data);
    
    // Update field extraction section
    const elements = {
        fullName: document.getElementById('fullName'),
        firstName: document.getElementById('firstName'),
        lastName: document.getElementById('lastName'),
        billingAddress: document.getElementById('billingAddress'),
        city: document.getElementById('city'),
        state: document.getElementById('state'),
        zipCode: document.getElementById('zipCode'),
        cardNumber: document.getElementById('cardNumber'),
        securityCode: document.getElementById('securityCode'),
        expMonth: document.getElementById('expMonth'),
        expYear: document.getElementById('expYear'),
        country: document.getElementById('country')
    };

    // Update each field if element exists
    if (elements.fullName) elements.fullName.textContent = data.fullName || '';
    if (elements.firstName) elements.firstName.textContent = data.firstName || '';
    if (elements.lastName) elements.lastName.textContent = data.lastName || '';
    if (elements.billingAddress) elements.billingAddress.textContent = data.billingAddress || '';
    if (elements.city) elements.city.textContent = data.city || '';
    if (elements.state) elements.state.textContent = data.state || '';
    if (elements.zipCode) elements.zipCode.textContent = data.zipCode || '';
    if (elements.cardNumber) elements.cardNumber.textContent = data.maskedCard || '';
    if (elements.securityCode) elements.securityCode.textContent = '***';
    if (elements.expMonth) elements.expMonth.textContent = data.expMonth || '';
    if (elements.expYear) elements.expYear.textContent = data.expYear || '';
    if (elements.country) elements.country.textContent = data.country || 'USA';

    console.log('✅ Field elements updated');

    // Update dashboard preview
    const dashboardElements = {
        btnText: document.getElementById('btnText'),
        cardholderName: document.getElementById('cardholderName'),
        paymentAmount: document.getElementById('paymentAmount')
    };

    if (dashboardElements.btnText) dashboardElements.btnText.textContent = data.maskedCard || '****1234';
    if (dashboardElements.cardholderName) dashboardElements.cardholderName.textContent = data.fullName || 'Veronica Hind';
    if (dashboardElements.paymentAmount) dashboardElements.paymentAmount.textContent = `$${data.paymentAmount || '150.00'}`;

    console.log('✅ Dashboard elements updated');
    
    // Generate JSON with real data
    generateJSONWithCapturedData(data);
    
    console.log('✅ Page update complete');
}

// Generate JSON with captured data
function generateJSONWithCapturedData(data) {
    const jsonString = JSON.stringify(data, null, 2);
    document.getElementById('jsonOutput').textContent = jsonString;
    console.log('📄 Generated JSON with captured data:', data);
}

// Show captured data notification
function showCapturedDataNotification(data) {
    // Create notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #6b46c1 0%, #553c9a 100%);
        color: white;
        padding: 20px 30px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(107, 70, 193, 0.3);
        z-index: 100000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-weight: 600;
        font-size: 16px;
        max-width: 500px;
        text-align: center;
        border: 2px solid rgba(255, 255, 255, 0.2);
        animation: slideInDown 0.5s ease-out;
    `;

    notification.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
            <span style="font-size: 24px;">🎉</span>
            <div>
                <div style="font-weight: 600; font-size: 18px;">Real Data Captured!</div>
                <div style="font-size: 14px; opacity: 0.9; margin-top: 5px;">
                    Job: <strong>${data.jobNumber}</strong> | Customer: <strong>${data.fullName || 'Unknown'}</strong>
                </div>
                <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">
                    Captured at: ${new Date(data.capturedAt).toLocaleString()}
                </div>
            </div>
        </div>
    `;

    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInDown {
            from {
                transform: translateX(-50%) translateY(-100%);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Auto-remove after 6 seconds
    setTimeout(() => {
        notification.style.animation = 'slideInDown 0.5s ease-out reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 500);
    }, 6000);
}

// Simulate field extraction from HelloMoving form
function simulateFieldExtraction() {
    console.log('🧪 Simulating HelloMoving field extraction...');
    
    // Simulate extracting data from HelloMoving form fields
    const mockData = {
        fullName: 'Anita Setser',
        billingAddress: '123 Main Street',
        city: 'Hammond',
        state: 'LA',
        zipCode: '70401',
        cardNumber: '4111111111111234',
        securityCode: '123',
        expMonth: '10',
        expYear: '2025'
    };

    // Update the display fields
    document.getElementById('fullName').textContent = mockData.fullName;
    document.getElementById('firstName').textContent = mockData.fullName.split(' ')[0];
    document.getElementById('lastName').textContent = mockData.fullName.split(' ').slice(1).join(' ');
    document.getElementById('billingAddress').textContent = mockData.billingAddress;
    document.getElementById('city').textContent = mockData.city;
    document.getElementById('state').textContent = mockData.state;
    document.getElementById('zipCode').textContent = mockData.zipCode;
    document.getElementById('cardNumber').textContent = `****${mockData.cardNumber.slice(-4)}`;
    document.getElementById('securityCode').textContent = '***';
    document.getElementById('expMonth').textContent = mockData.expMonth;
    document.getElementById('expYear').textContent = mockData.expYear;
    document.getElementById('country').textContent = 'USA';

    console.log('✅ Field extraction simulation complete');
}

// Clear all fields
function clearFields() {
    const fields = ['fullName', 'firstName', 'lastName', 'billingAddress', 'city', 'state', 'zipCode', 'cardNumber', 'securityCode', 'expMonth', 'expYear'];
    fields.forEach(fieldId => {
        const element = document.getElementById(fieldId);
        if (element) {
            element.textContent = '';
            element.classList.add('field-empty');
        }
    });
    console.log('🗑️ Fields cleared');
}

// Test processing logic
function testProcessingLogic() {
    console.log('🔄 Testing processing logic...');
    
    // Simulate the processing
    const fullName = 'Anita Setser';
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    const cardNumber = '4111111111111234';
    const maskedCard = `****${cardNumber.slice(-4)}`;
    const cardLastFour = cardNumber.slice(-4);
    
    const expDate = '10/25';
    
    console.log('Processing Results:');
    console.log('- First Name:', firstName);
    console.log('- Last Name:', lastName);
    console.log('- Masked Card:', maskedCard);
    console.log('- Card Last Four:', cardLastFour);
    console.log('- Exp Date:', expDate);
    
    alert(`Processing Complete!\n\nFirst Name: ${firstName}\nLast Name: ${lastName}\nMasked Card: ${maskedCard}\nExp Date: ${expDate}`);
}

// Generate JSON output
function generateJSON() {
    console.log('📄 Generating JSON output...');
    
    const paymentData = {
        jobNumber: 'S2321771',
        customerName: 'Yoohyun Jeong',
        timestamp: new Date().toISOString(),
        payment: {
            // Personal Information
            fullName: 'Anita Setser',
            firstName: 'Anita',
            lastName: 'Setser',
            
            // Address Information
            billingAddress: '123 Main Street',
            city: 'Hammond',
            state: 'LA',
            zipCode: '70401',
            country: 'USA',
            
            // Card Information
            cardNumber: '4111111111111234',
            maskedCard: '****1234',
            cardLastFour: '1234',
            securityCode: '123',
            expMonth: '10',
            expYear: '2025',
            expDate: '10/25',
            
            // Transaction Information
            amount: 150.00,
            transactionId: 'TXN' + Date.now(),
            authCode: 'AUTH' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            status: 'processed'
        }
    };

    const jsonString = JSON.stringify(paymentData, null, 2);
    document.getElementById('jsonOutput').textContent = jsonString;
    
    console.log('✅ JSON generated:', paymentData);
}

// Copy JSON to clipboard
function copyToClipboard() {
    const jsonContent = document.getElementById('jsonOutput').textContent;
    if (jsonContent && jsonContent !== 'Click "Generate JSON" to see the output...') {
        navigator.clipboard.writeText(jsonContent).then(() => {
            alert('JSON copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert('Failed to copy to clipboard');
        });
    } else {
        alert('Please generate JSON first');
    }
}

// Update dashboard preview
function updateDashboardPreview() {
    console.log('🔄 Updating dashboard preview...');
    
    document.getElementById('btnText').textContent = '****1234';
    document.getElementById('cardholderName').textContent = 'Anita Setser';
    document.getElementById('paymentAmount').textContent = '$150.00';
    document.getElementById('paymentStatus').textContent = '✅ Processed';
    document.getElementById('paymentStatus').className = 'status-indicator status-success';
    
    console.log('✅ Dashboard preview updated');
}

// Manual test function to display captured data
function testDisplayCapturedData() {
    console.log('🧪 Testing display of captured data...');
    
    // Try to load from localStorage
    const capturedData = localStorage.getItem('capturedPaymentData');
    if (capturedData) {
        const data = JSON.parse(capturedData);
        console.log('📋 Found captured data:', data);
        
        // Update the page with this data
        updatePageWithCapturedData(data);
        
        // Show notification
        showReceivedDataNotification(data);
        
        console.log('✅ Captured data displayed successfully');
    } else {
        console.log('❌ No captured data found in localStorage');
        alert('No captured data found. Please capture data from HelloMoving page first.');
    }
}

// Make test function globally available
window.testDisplayCapturedData = testDisplayCapturedData;
