// Closer Extension Login System
const SUPABASE_URL = 'process.env.SUPABASE_URL';
const SUPABASE_ANON_KEY = 'process.env.SUPABASE_ANON_KEY';

let currentCloser = null;

// DOM elements
let loginSection, loggedInSection, closerSecretKeyInput, loginBtn, logoutBtn, closerNameSpan;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    loginSection = document.getElementById('loginSection');
    loggedInSection = document.getElementById('loggedInSection');
    closerSecretKeyInput = document.getElementById('closerSecretKey');
    loginBtn = document.getElementById('loginBtn');
    logoutBtn = document.getElementById('logoutBtn');
    closerNameSpan = document.getElementById('closerName');
    
    // Check if already logged in
    chrome.storage.local.get(['closerUser'], function(result) {
        if (result.closerUser) {
            currentCloser = result.closerUser;
            showLoggedInState();
        } else {
            showLoginState();
        }
    });
    
    // Event listeners
    loginBtn.addEventListener('click', handleCloserLogin);
    logoutBtn.addEventListener('click', handleCloserLogout);
    closerSecretKeyInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleCloserLogin();
        }
    });
});

async function handleCloserLogin() {
    const secretKey = closerSecretKeyInput.value.trim();
    if (!secretKey) {
        alert('Please enter your secret key');
        return;
    }
    
    try {
        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;
        
        console.log('🔐 Attempting closer login with key:', secretKey);
        
        // First, let's test the basic connection with a simple request
        console.log('🔗 Testing basic Supabase connection...');
        const testResponse = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_users?select=count`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('🔗 Basic connection test:', testResponse.status, testResponse.statusText);
        
        if (!testResponse.ok) {
            const errorText = await testResponse.text();
            console.error('❌ Connection failed:', errorText);
            alert(`Database connection failed: ${testResponse.status}\n\nError: ${errorText}`);
            return;
        }
        
        const testData = await testResponse.json();
        console.log('📊 Total users in database:', testData);
        
        // Now let's try to get all users
        console.log('🔍 Fetching all users to see what exists...');
        const allUsersResponse = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_users?select=*`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('🔍 All users response:', allUsersResponse.status, allUsersResponse.statusText);
        
        if (!allUsersResponse.ok) {
            const errorText = await allUsersResponse.text();
            console.error('❌ Users fetch failed:', errorText);
            alert(`Failed to fetch users: ${allUsersResponse.status}\n\nError: ${errorText}`);
            return;
        }
        
        const allUsers = await allUsersResponse.json();
        console.log('👥 All users in database:', allUsers);
        
        // Debug: Show all field names for Dan's user
        const danUser = allUsers.find(user => user.name === 'Dan');
        if (danUser) {
            console.log('👤 Dan user object:', danUser);
            console.log('🔑 Dan user field names:', Object.keys(danUser));
            console.log('🔍 Dan user values:', Object.entries(danUser));
        }
        
        // Debug: Show all secret keys (try different field names)
        console.log('🔑 All secret keys in database:');
        allUsers.forEach(user => {
            console.log(`  - ${user.name}: secret_key="${user.secret_key}", secretkey="${user.secretkey}", secretKey="${user.secretKey}", key="${user.key}"`);
        });
        console.log(`🔍 Looking for: "${secretKey}" (length: ${secretKey.length})`);
        
        // Try different field names for secret key
        const userWithKey = allUsers.find(user => 
            (user.secret_key && user.secret_key.toLowerCase().trim() === secretKey.toLowerCase().trim()) ||
            (user.secretkey && user.secretkey.toLowerCase().trim() === secretKey.toLowerCase().trim()) ||
            (user.secretKey && user.secretKey.toLowerCase().trim() === secretKey.toLowerCase().trim()) ||
            (user.key && user.key.toLowerCase().trim() === secretKey.toLowerCase().trim())
        );
        console.log('🔍 User found with key:', userWithKey);
        
        if (userWithKey) {
            console.log('👤 User details:', userWithKey);
            console.log('🔑 User role:', userWithKey.role);
            console.log('✅ User active (is_active):', userWithKey.is_active, typeof userWithKey.is_active);
            console.log('✅ User active (isactive):', userWithKey.isactive, typeof userWithKey.isactive);
            console.log('✅ User active (IsActive):', userWithKey.IsActive, typeof userWithKey.IsActive);
            
            // Check if user is active (try different field names and types)
            const isActive = userWithKey.is_active || userWithKey.isactive || userWithKey.IsActive;
            const isActiveValue = isActive === true || isActive === 'true' || isActive === 1 || isActive === '1';
            
            console.log('🔍 Final active check:', isActiveValue);
            
            if (!isActiveValue) {
                alert(`Your account is inactive. Please contact your manager.\n\nDebug: is_active=${userWithKey.is_active}, isactive=${userWithKey.isactive}, IsActive=${userWithKey.IsActive}`);
                return;
            }
            
            // Allow any role to login as closer
            currentCloser = userWithKey;
            chrome.storage.local.set({ closerUser: userWithKey });
            showLoggedInState();
            closerSecretKeyInput.value = '';
            console.log('✅ Login successful for:', userWithKey.name);
            return;
        }
        
        // If we get here, no user was found
        alert(`Invalid secret key. Please check with your manager.\n\nDebug: No user found with secret key "${secretKey}"\n\nAvailable users: ${allUsers.map(u => u.name).join(', ')}`);
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.\n\nError: ' + error.message);
    } finally {
        loginBtn.textContent = 'Login as Closer';
        loginBtn.disabled = false;
    }
}

function handleCloserLogout() {
    currentCloser = null;
    chrome.storage.local.remove(['closerUser']);
    showLoginState();
}

function showLoginState() {
    loginSection.style.display = 'block';
    loggedInSection.style.display = 'none';
}

function showLoggedInState() {
    loginSection.style.display = 'none';
    loggedInSection.style.display = 'block';
    closerNameSpan.textContent = currentCloser.name;
}

function testOverlays() {
    if (!currentCloser) {
        alert('Please login first');
        return;
    }
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            function: () => {
                if (typeof testCreateOverlays === 'function') {
                    testCreateOverlays();
                } else {
                    alert('Please navigate to a HelloMoving pricing page first.');
                }
            }
        });
    });
}

// Make testOverlays globally available
window.testOverlays = testOverlays;
