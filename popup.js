// Chrome Extension Popup with Dashboard User Management Integration
document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup loaded - initializing dashboard-integrated system');
    
    // DOM elements
    const loginSection = document.getElementById('loginSection');
    const secretKeyInput = document.getElementById('secretKeyInput');
    const loginBtn = document.getElementById('loginBtn');
    const userInfo = document.getElementById('userInfo');
    const currentUser = document.getElementById('currentUser');
    const userRole = document.getElementById('userRole');
    const logoutBtn = document.getElementById('logoutBtn');
    
    let currentUserData = null;
    
    // Check if user is already logged in
    checkLoginStatus();
    
    // Event listeners
    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    secretKeyInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
    
    // Login function - validates against Supabase users
    async function handleLogin() {
        const secretKey = secretKeyInput.value.trim();
        if (!secretKey) {
            showNotification('Please enter your secret key', 'error');
            return;
        }
        
        try {
            // Show loading state
            loginBtn.textContent = 'Logging in...';
            loginBtn.disabled = true;
            
            console.log('🔐 Attempting login with key:', secretKey);
            console.log('🔍 Secret key length:', secretKey.length);
            
            // First, let's test the connection and see what tables exist
            console.log('🔗 Testing Supabase connection...');
            const testResponse = await fetch('process.env.SUPABASE_URL/rest/v1/', {
                headers: {
                    'apikey': 'process.env.SUPABASE_ANON_KEY',
                    'Authorization': 'Bearer process.env.SUPABASE_ANON_KEY'
                }
            });
            
            console.log('🔗 Supabase connection test:', testResponse.status, testResponse.statusText);
            
            // Try different possible table names
            const possibleTables = ['dashboard_users', 'users', 'user_management', 'dashboard_users_table'];
            
            for (const tableName of possibleTables) {
                try {
                    console.log(`🔍 Trying table: ${tableName}`);
                    
                    const response = await fetch(`process.env.SUPABASE_URL/rest/v1/${tableName}?select=*`, {
                        headers: {
                            'apikey': 'process.env.SUPABASE_ANON_KEY',
                            'Authorization': 'Bearer process.env.SUPABASE_ANON_KEY'
                        }
                    });
                    
                    console.log(`📡 Response for ${tableName}:`, response.status, response.statusText);
                    
                    if (response.ok) {
                        const users = await response.json();
                        console.log(`✅ Found table ${tableName} with ${users.length} users:`, users);
                        
                        // Debug: Show the actual column names from first user
                        if (users.length > 0) {
                            console.log('🔍 First user object keys:', Object.keys(users[0]));
                            console.log('🔍 Sample user data:', users[0]);
                        }
                        
                        // Now try to find user by secret key (handle different column names)
                        console.log('🔍 Looking for user with secret key:', secretKey);
                        const user = users.find(u => {
                            const match = u.secretKey === secretKey || 
                                         u.secret_key === secretKey || 
                                         u.secretkey === secretKey;
                            console.log(`🔍 Checking user ${u.name}:`, {
                                secretKey: u.secretKey,
                                secret_key: u.secret_key,
                                secretkey: u.secretkey,
                                match: match
                            });
                            return match;
                        });
                        
                        if (user) {
                            console.log('✅ User found:', user);
                            
                            // Check if user is active (handle different possible field names)
                            const isActive = user.isActive !== false && user.is_active !== false && user.isactive !== false;
                            console.log('🔍 User active status:', {
                                isActive: user.isActive,
                                is_active: user.is_active,
                                isactive: user.isactive,
                                final: isActive
                            });
                            
                            if (isActive) {
                                // Store user info in Chrome storage
                                currentUserData = user;
                                chrome.storage.local.set({ popupUser: user }, () => {
                                    showUserInfo(user);
                                    console.log('User logged in:', user.name, 'Role:', user.role);
                                    
                                    // Clear input
                                    secretKeyInput.value = '';
                                    
                                    // Show success notification
                                    showNotification(`Welcome, ${user.name}!`, 'success');
                                });
                                return; // Exit the loop
                            } else {
                                showNotification('User account is inactive', 'error');
                                return;
                            }
                        } else {
                            console.log('❌ No user found with that secret key');
                        }
                    } else {
                        console.log(`❌ Table ${tableName} not accessible:`, response.status, response.statusText);
                        try {
                            const errorText = await response.text();
                            console.log(`❌ Error details:`, errorText);
                        } catch (e) {
                            console.log(`❌ Could not read error response`);
                        }
                    }
                } catch (error) {
                    console.log(`❌ Error accessing table ${tableName}:`, error);
                }
            }
            
            // If we get here, no user was found
            console.log('❌ No valid user found in any table');
            showNotification('Invalid secret key or user not found', 'error');
            
        } catch (error) {
            console.error('❌ Login error:', error);
            showNotification('Network error. Please check your connection.', 'error');
        } finally {
            // Reset button state
            loginBtn.textContent = 'Login';
            loginBtn.disabled = false;
        }
    }
    
    // Logout function
    function handleLogout() {
        chrome.storage.local.remove(['popupUser'], () => {
            currentUserData = null;
            showLoginForm();
            console.log('User logged out');
            showNotification('Logged out successfully', 'success');
        });
    }
    
    // Show user info after login
    function showUserInfo(user) {
        loginSection.style.display = 'none';
        userInfo.style.display = 'block';
        
        // Set the user information text content
        currentUser.textContent = user.name;
        userRole.textContent = user.role;
        
        // Update page title to show user is logged in
        document.title = `Page Price Analyzer - ${user.name}`;
    }
    
    // Show login form
    function showLoginForm() {
        loginSection.style.display = 'block';
        userInfo.style.display = 'none';
        document.title = 'Page Price Analyzer';
    }
    
    // Check login status
    function checkLoginStatus() {
        chrome.storage.local.get(['popupUser'], (result) => {
            if (result.popupUser) {
                currentUserData = result.popupUser;
                showUserInfo(result.popupUser);
            } else {
                showLoginForm();
            }
        });
    }
    
    // Show notification
    function showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 5px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            background: ${type === 'success' ? '#28a745' : '#dc3545'};
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    // Debug functions for testing
    window.testExtensionStatus = function() {
        console.log('🧪 Testing extension status...');
        console.log('Current user data:', currentUserData);
        console.log('Login section visible:', loginSection.style.display !== 'none');
        console.log('User info visible:', userInfo.style.display !== 'none');
        
        chrome.storage.local.get(['popupUser'], (result) => {
            console.log('Chrome storage popupUser:', result.popupUser);
        });
    };
    
    window.testLogin = function() {
        console.log('🧪 Testing login function...');
        const testKey = 'admin'; // Use your admin key
        console.log('Testing with key:', testKey);
        
        // Temporarily set the input value and trigger login
        secretKeyInput.value = testKey;
        handleLogin();
    };
    
    window.testSupabaseConnection = async function() {
        console.log('🧪 Testing Supabase connection...');
        try {
            const response = await fetch('process.env.SUPABASE_URL/rest/v1/dashboard_users?select=*', {
                headers: {
                    'apikey': 'process.env.SUPABASE_ANON_KEY',
                    'Authorization': 'Bearer process.env.SUPABASE_ANON_KEY'
                }
            });
            
            console.log('Supabase test response:', response.status, response.statusText);
            
            if (response.ok) {
                const users = await response.json();
                console.log('Users found:', users.length);
                console.log('First user:', users[0]);
            } else {
                const errorText = await response.text();
                console.log('Error response:', errorText);
            }
        } catch (error) {
            console.error('Supabase test error:', error);
        }
    };
    
    console.log('🔧 Debug functions available:');
    console.log('- testExtensionStatus() - Check extension state');
    console.log('- testLogin() - Test login with admin key');
    console.log('- testSupabaseConnection() - Test Supabase connection');
    
    // Initialize price box functionality
    initializePriceBoxes();
    
    // Initialize payment processing functionality
    initializePaymentProcessing();
});

// Function to initialize price box functionality
function initializePriceBoxes() {
    console.log('🔧 Initializing price boxes...');
    
    // Get all price input elements
    const depositInput = document.getElementById('depositInput');
    const pickupInput = document.getElementById('pickupInput');
    const dropoffInput = document.getElementById('dropoffInput');
    
    // Get all price amount display elements
    const depositAmount = document.getElementById('depositAmount');
    const pickupAmount = document.getElementById('pickupAmount');
    const dropoffAmount = document.getElementById('dropoffAmount');
    
    // Function to format currency
    function formatCurrency(amount) {
        if (!amount || isNaN(amount)) return '$0.00';
        return '$' + parseFloat(amount).toFixed(2);
    }
    
    // Function to update price display
    function updatePriceDisplay(input, display) {
        const value = input.value;
        display.textContent = formatCurrency(value);
        
        // Save to storage
        savePriceData();
    }
    
    // Add event listeners for input changes
    if (depositInput && depositAmount) {
        depositInput.addEventListener('input', () => updatePriceDisplay(depositInput, depositAmount));
        depositInput.addEventListener('blur', () => updatePriceDisplay(depositInput, depositAmount));
    }
    
    if (pickupInput && pickupAmount) {
        pickupInput.addEventListener('input', () => updatePriceDisplay(pickupInput, pickupAmount));
        pickupInput.addEventListener('blur', () => updatePriceDisplay(pickupInput, pickupAmount));
    }
    
    if (dropoffInput && dropoffAmount) {
        dropoffInput.addEventListener('input', () => updatePriceDisplay(dropoffInput, dropoffAmount));
        dropoffInput.addEventListener('blur', () => updatePriceDisplay(dropoffInput, dropoffAmount));
    }
    
    // Load saved price data
    loadPriceData();
    
    console.log('✅ Price boxes initialized');
}

// Function to save price data to Chrome storage
function savePriceData() {
    const priceData = {
        deposit: document.getElementById('depositInput')?.value || '0',
        pickup: document.getElementById('pickupInput')?.value || '0',
        dropoff: document.getElementById('dropoffInput')?.value || '0',
        lastUpdated: new Date().toISOString()
    };
    
    chrome.storage.local.set({ priceData }, () => {
        console.log('💾 Price data saved:', priceData);
    });
}

// Function to load price data from Chrome storage
function loadPriceData() {
    chrome.storage.local.get(['priceData'], (result) => {
        if (result.priceData) {
            const data = result.priceData;
            console.log('📥 Loading saved price data:', data);
            
            // Update input fields
            const depositInput = document.getElementById('depositInput');
            const pickupInput = document.getElementById('pickupInput');
            const dropoffInput = document.getElementById('dropoffInput');
            
            if (depositInput && data.deposit) {
                depositInput.value = data.deposit;
                document.getElementById('depositAmount').textContent = formatCurrency(data.deposit);
            }
            
            if (pickupInput && data.pickup) {
                pickupInput.value = data.pickup;
                document.getElementById('pickupAmount').textContent = formatCurrency(data.pickup);
            }
            
            if (dropoffInput && data.dropoff) {
                dropoffInput.value = data.dropoff;
                document.getElementById('dropoffAmount').textContent = formatCurrency(data.dropoff);
            }
        }
    });
}

// Helper function for currency formatting (make it globally available)
function formatCurrency(amount) {
    if (!amount || isNaN(amount)) return '$0.00';
    return '$' + parseFloat(amount).toFixed(2);
}

// ---- GoHighLevel contact query helper (console-usable in popup context) ----
// Usage in popup DevTools console:
//   await queryGhlContactByFirstName('first name', { exact: true })
(() => {
	const GHL_API_KEY = process.env.GHL_API_KEY;
	let GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

	async function getWorkingGhlAuth() {
		const formats = [GHL_API_KEY, `Bearer ${GHL_API_KEY}`];
		for (const fmt of formats) {
			try {
				const res = await fetch('https://services.leadconnectorhq.com/contacts/', {
					method: 'GET',
					headers: { 'Accept': 'application/json', 'Authorization': fmt, 'Version': '2021-07-28' }
				});
				if (res.ok || res.status === 403) return fmt;
			} catch (_) {}
		}
		throw new Error('No working GHL auth format');
	}

	async function fetchAllContacts(authHeader) {
		const base = 'https://services.leadconnectorhq.com/contacts/';
		const url = GHL_LOCATION_ID ? `${base}?locationId=${encodeURIComponent(GHL_LOCATION_ID)}` : base;
		const res = await fetch(url, {
			method: 'GET',
			headers: { 'Accept': 'application/json', 'Authorization': authHeader, 'Version': '2021-07-28' }
		});
		if (!res.ok) throw new Error(`Contacts fetch failed: ${res.status} ${await res.text()}`);
		const json = await res.json();
		const list = json.contacts || json || [];
		return Array.isArray(list) ? list : [];
	}

	function flattenObject(record, { prefix = '', out = {} } = {}) {
		const isPlainObject = (val) => val && typeof val === 'object' && !Array.isArray(val);
		Object.keys(record || {}).forEach((key) => {
			const value = record[key];
			const fullKey = prefix ? `${prefix}_${key}` : key;
			if (isPlainObject(value)) {
				flattenObject(value, { prefix: fullKey, out });
			} else {
				out[fullKey] = value;
			}
		});
		return out;
	}

	function suggestPgType(value) {
		if (value === null || value === undefined) return 'TEXT';
		if (typeof value === 'boolean') return 'BOOLEAN';
		if (typeof value === 'number') return Number.isInteger(value) ? 'BIGINT' : 'DECIMAL';
		if (typeof value === 'string') {
			if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'TIMESTAMP';
			if (value.length > 255) return 'TEXT';
			return 'VARCHAR(255)';
		}
		if (Array.isArray(value)) return 'JSONB';
		if (typeof value === 'object') return 'JSONB';
		return 'TEXT';
	}

	function generateSupabaseCreateTableSQL(records, tableName = 'ghl_contacts_all_fields') {
		const columns = new Map();
		const consider = (obj) => {
			Object.entries(obj).forEach(([k, v]) => {
				if (!columns.has(k)) columns.set(k, suggestPgType(v));
			});
		};
		records.forEach((rec) => {
			const base = { ...rec };
			if (Array.isArray(base.customFields)) {
				const mapped = {};
				base.customFields.forEach((f) => {
					mapped[f.id] = f.value;
				});
				base.customFieldsMapped = mapped;
			}
			const flat = flattenObject(base);
			consider(flat);
		});
		const colsSql = Array.from(columns.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([name, type]) => `    "${name}" ${type}`)
			.join(',\n');
		return `CREATE TABLE IF NOT EXISTS ${tableName} (\n    id BIGSERIAL PRIMARY KEY,\n${colsSql}\n);`;
	}

	async function queryGhlContactByFirstName(firstName, { exact = true, limit = 50 } = {}) {
		if (!firstName) throw new Error('firstName is required');
		const auth = await getWorkingGhlAuth();
		const contacts = await fetchAllContacts(auth);
		const matches = contacts.filter(c => {
			const fn = (c.firstName || '').toString();
			if (!fn) return false;
			return exact ? fn.toLowerCase() === firstName.toLowerCase() : fn.toLowerCase().includes(firstName.toLowerCase());
		}).slice(0, limit);
		console.log('GHL contact search result:', { firstName, exact, limit, totalFetched: contacts.length, matches });
		if (matches[0]) console.log('First match (full JSON):', matches[0]);
		const ddl = generateSupabaseCreateTableSQL(matches);
		console.log('Suggested Supabase DDL:\n' + ddl);
		return matches;
	}

	// Expose to window for console usage
	window.queryGhlContactByFirstName = queryGhlContactByFirstName;
	window.generateSupabaseCreateTableSQL = generateSupabaseCreateTableSQL;
})();

// Payment Processing Functions
function initializePaymentProcessing() {
    console.log('💳 Initializing payment processing...');
    
    // Initialize payment service
    window.paymentService = new PaymentService();
    
    // Get DOM elements
    const paymentSection = document.getElementById('paymentSection');
    const processPaymentBtn = document.getElementById('processPaymentBtn');
    const testPaymentBtn = document.getElementById('testPaymentBtn');
    const cardNumberInput = document.getElementById('cardNumber');
    const expDateInput = document.getElementById('expDate');
    const cvvInput = document.getElementById('cvv');
    const cardTypeIndicator = document.getElementById('cardTypeIndicator');
    
    // Show payment section if user is logged in
    checkLoginStatus().then(user => {
        if (user && user.role === 'admin') {
            paymentSection.style.display = 'block';
            loadRecentTransactions();
        }
    });
    
    // Event listeners
    if (processPaymentBtn) {
        processPaymentBtn.addEventListener('click', handleProcessPayment);
    }
    
    if (testPaymentBtn) {
        testPaymentBtn.addEventListener('click', handleTestPayment);
    }
    
    // Card number formatting and validation
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', handleCardNumberInput);
        cardNumberInput.addEventListener('blur', validateCardNumber);
    }
    
    // Expiration date formatting
    if (expDateInput) {
        expDateInput.addEventListener('input', handleExpDateInput);
    }
    
    // CVV validation
    if (cvvInput) {
        cvvInput.addEventListener('input', handleCvvInput);
    }
    
    console.log('✅ Payment processing initialized');
}

// Handle card number input with formatting
function handleCardNumberInput(event) {
    let value = event.target.value.replace(/\D/g, ''); // Remove non-digits
    
    // Format with spaces every 4 digits
    value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    
    // Limit to 19 characters (16 digits + 3 spaces)
    value = value.substring(0, 19);
    
    event.target.value = value;
    
    // Update card type indicator
    updateCardTypeIndicator(value.replace(/\s/g, ''));
}

// Update card type indicator
function updateCardTypeIndicator(cardNumber) {
    const cardTypeIndicator = document.getElementById('cardTypeIndicator');
    const cardType = detectCardType(cardNumber);
    
    if (cardTypeIndicator) {
        const cardIcons = {
            visa: '💳',
            mastercard: '💳',
            amex: '💳',
            discover: '💳',
            unknown: ''
        };
        
        cardTypeIndicator.textContent = cardIcons[cardType] || '';
        cardTypeIndicator.className = `card-type-indicator ${cardNumber.length >= 13 ? 'show' : ''}`;
    }
}

// Handle expiration date input with formatting
function handleExpDateInput(event) {
    let value = event.target.value.replace(/\D/g, ''); // Remove non-digits
    
    // Format as MM/YY
    if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    
    // Limit to 5 characters (MM/YY)
    value = value.substring(0, 5);
    
    event.target.value = value;
}

// Handle CVV input
function handleCvvInput(event) {
    let value = event.target.value.replace(/\D/g, ''); // Remove non-digits
    
    // Limit to 4 digits (Amex uses 4 digits)
    value = value.substring(0, 4);
    
    event.target.value = value;
}

// Validate card number
function validateCardNumber(event) {
    const cardNumber = event.target.value.replace(/\s/g, '');
    const isValid = validateCardNumber(cardNumber);
    
    if (cardNumber.length > 0 && !isValid) {
        event.target.style.borderColor = '#dc3545';
        showPaymentNotification('Invalid card number', 'error');
    } else {
        event.target.style.borderColor = '#e6d9ff';
    }
}

// Handle process payment button click
async function handleProcessPayment() {
    console.log('💳 Processing payment...');
    
    // Get form data
    const paymentData = getPaymentFormData();
    
    if (!paymentData) {
        return; // Validation failed
    }
    
    // Show processing state
    showPaymentStatus('processing', 'Processing Payment...', 'Please wait while we process your payment...');
    
    try {
        // Process payment
        const result = await window.paymentService.processPayment(paymentData);
        
        if (result.success) {
            showPaymentStatus('success', 'Payment Successful!', 
                `Transaction ID: ${result.transactionId}<br>Amount: $${result.amount}<br>Auth Code: ${result.authCode}`);
            
            // Clear form
            clearPaymentForm();
            
            // Load recent transactions
            loadRecentTransactions();
            
            showPaymentNotification('Payment processed successfully!', 'success');
        } else {
            showPaymentStatus('error', 'Payment Failed', 
                `${result.responseMessage || 'Payment could not be processed'}<br>Response Code: ${result.responseCode}`);
            
            showPaymentNotification('Payment failed. Please check your card information.', 'error');
        }
        
    } catch (error) {
        console.error('Payment processing error:', error);
        showPaymentStatus('error', 'Payment Error', error.message);
        showPaymentNotification('Payment processing failed. Please try again.', 'error');
    }
}

// Handle test payment button click
async function handleTestPayment() {
    console.log('🧪 Processing test payment...');
    
    // Fill form with test data
    fillTestData();
    
    // Process payment
    await handleProcessPayment();
}

// Fill form with test data
function fillTestData() {
    document.getElementById('paymentAmount').value = '1.00';
    document.getElementById('cardNumber').value = PAYMENT_CONFIG.TEST_CARDS.VISA;
    document.getElementById('expDate').value = '12/25';
    document.getElementById('cvv').value = '123';
    document.getElementById('cardFirstName').value = 'Test';
    document.getElementById('cardLastName').value = 'User';
    document.getElementById('transactionType').value = 'ccsale';
    
    // Update card type indicator
    updateCardTypeIndicator(PAYMENT_CONFIG.TEST_CARDS.VISA);
}

// Get payment form data
function getPaymentFormData() {
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
    const expDate = document.getElementById('expDate').value;
    const cvv = document.getElementById('cvv').value;
    const firstName = document.getElementById('cardFirstName').value.trim();
    const lastName = document.getElementById('cardLastName').value.trim();
    const transactionType = document.getElementById('transactionType').value;
    
    // Validation
    if (!amount || amount <= 0) {
        showPaymentNotification('Please enter a valid amount', 'error');
        return null;
    }
    
    if (!cardNumber || !validateCardNumber(cardNumber)) {
        showPaymentNotification('Please enter a valid card number', 'error');
        return null;
    }
    
    if (!expDate || !/^\d{2}\/\d{2}$/.test(expDate)) {
        showPaymentNotification('Please enter a valid expiration date (MM/YY)', 'error');
        return null;
    }
    
    if (!cvv || cvv.length < 3) {
        showPaymentNotification('Please enter a valid CVV', 'error');
        return null;
    }
    
    if (!firstName || firstName.length < 2) {
        showPaymentNotification('Please enter a valid first name', 'error');
        return null;
    }
    
    if (!lastName || lastName.length < 2) {
        showPaymentNotification('Please enter a valid last name', 'error');
        return null;
    }
    
    return {
        amount: amount,
        cardNumber: cardNumber,
        expDate: expDate,
        cvv: cvv,
        firstName: firstName,
        lastName: lastName,
        transactionType: transactionType
    };
}

// Show payment status
function showPaymentStatus(type, title, message) {
    const statusDiv = document.getElementById('paymentStatus');
    const statusIcon = document.getElementById('statusIcon');
    const statusTitle = document.getElementById('statusTitle');
    const statusMessage = document.getElementById('statusMessage');
    
    if (statusDiv) {
        statusDiv.className = `payment-status ${type}`;
        statusDiv.style.display = 'block';
        
        if (statusIcon) {
            const icons = {
                success: '✅',
                error: '❌',
                processing: '⏳'
            };
            statusIcon.textContent = icons[type] || '';
        }
        
        if (statusTitle) {
            statusTitle.textContent = title;
        }
        
        if (statusMessage) {
            statusMessage.innerHTML = message;
        }
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
    }
}

// Show payment notification
function showPaymentNotification(message, type) {
    showNotification(message, type);
}

// Clear payment form
function clearPaymentForm() {
    document.getElementById('paymentAmount').value = '';
    document.getElementById('cardNumber').value = '';
    document.getElementById('expDate').value = '';
    document.getElementById('cvv').value = '';
    document.getElementById('cardFirstName').value = '';
    document.getElementById('cardLastName').value = '';
    document.getElementById('transactionType').value = 'ccsale';
    
    // Clear card type indicator
    const cardTypeIndicator = document.getElementById('cardTypeIndicator');
    if (cardTypeIndicator) {
        cardTypeIndicator.textContent = '';
        cardTypeIndicator.className = 'card-type-indicator';
    }
}

// Load recent transactions
async function loadRecentTransactions() {
    try {
        const response = await fetch(`${CONFIG.SUPABASE.URL}/rest/v1/transactions?order=processed_at.desc&limit=5`, {
            headers: {
                'apikey': CONFIG.SUPABASE.ANON_KEY,
                'Authorization': `Bearer ${CONFIG.SUPABASE.ANON_KEY}`
            }
        });
        
        if (response.ok) {
            const transactions = await response.json();
            displayRecentTransactions(transactions);
        }
    } catch (error) {
        console.error('Error loading recent transactions:', error);
    }
}

// Display recent transactions
function displayRecentTransactions(transactions) {
    const recentTransactionsDiv = document.getElementById('recentTransactions');
    const transactionListDiv = document.getElementById('transactionList');
    
    if (recentTransactionsDiv && transactionListDiv) {
        if (transactions.length > 0) {
            recentTransactionsDiv.style.display = 'block';
            
            transactionListDiv.innerHTML = transactions.map(txn => `
                <div class="transaction-item ${txn.success ? 'success' : 'error'}">
                    <div class="transaction-amount">$${txn.amount} - ${txn.transaction_type}</div>
                    <div class="transaction-time">${new Date(txn.processed_at).toLocaleString()}</div>
                </div>
            `).join('');
        } else {
            recentTransactionsDiv.style.display = 'none';
        }
    }
}

// Helper function to check login status
async function checkLoginStatus() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['popupUser'], (result) => {
            resolve(result.popupUser || null);
        });
    });
}
