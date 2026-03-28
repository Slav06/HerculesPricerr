// Content script for CLOSER Chrome Extension
// This script runs on every page and extracts pricing information

// This is the CLOSER Chrome Extension
// Status buttons for closers
const statusButtons = [
    { id: 'submit', text: 'Submit Job', emoji: '📋', color: '#6b46c1', status: 'new_lead' },
    { id: 'quoted', text: 'Quoted', emoji: '💰', color: '#2563eb', status: 'quoted' },
    { id: 'won', text: 'Won', emoji: '🎉', color: '#16a34a', status: 'won' },
    { id: 'dropped', text: 'Dropped', emoji: '❌', color: '#dc3545', status: 'dropped' },
    { id: 'no-answer', text: 'No Answer', emoji: '📞', color: '#d97706', status: 'no_answer' },
    { id: 'voicemail', text: 'Voicemail', emoji: '📧', color: '#d97706', status: 'voicemail' },
    { id: 'booked-competitor', text: 'Booked to Competitor', emoji: '🚫', color: '#6c757d', status: 'booked_to_competitor' }
];

// Slack Integration Configuration
const SLACK_CONFIG = {
    webhookUrl: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK',
    channel: '#job-notifications',
    username: 'Job Tracker Bot',
    icon_emoji: ':truck:'
};

// Send Slack notification
async function sendSlackNotification(message, data = {}) {
    try {
        if (!SLACK_CONFIG.webhookUrl || SLACK_CONFIG.webhookUrl.includes('YOUR/SLACK/WEBHOOK')) {
            console.log('⚠️ Slack webhook not configured, skipping notification');
            return;
        }

        const payload = {
            channel: SLACK_CONFIG.channel,
            username: SLACK_CONFIG.username,
            icon_emoji: SLACK_CONFIG.icon_emoji,
            text: message,
            attachments: []
        };

        if (Object.keys(data).length > 0) {
            const fields = Object.entries(data).map(([key, value]) => ({
                title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                value: value,
                short: true
            }));
            
            payload.attachments.push({
                color: 'good',
                fields: fields,
                footer: 'Job Tracking System',
                ts: Math.floor(Date.now() / 1000)
            });
        }

        const response = await fetch(SLACK_CONFIG.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log('✅ Slack notification sent successfully');
        } else {
            console.error('❌ Failed to send Slack notification:', response.status);
        }
    } catch (error) {
        console.error('❌ Error sending Slack notification:', error);
    }
}

// Supabase Configuration
const SUPABASE_URL = 'process.env.SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Submit job to dashboard
async function submitJobToDashboard(status, extractedData) {
    try {
        console.log('📤 Submitting job to dashboard with status:', status);
        console.log('📊 Extracted data:', extractedData);

        const submissionData = {
            job_number: extractedData.jobNumber || 'Unknown',
            customer_name: extractedData.customerName || 'Unknown',
            moving_from: extractedData.movingFrom?.address || 'Unknown',
            moving_to: extractedData.movingTo?.address || 'Unknown',
            cubes: extractedData.cubes || null,
            distance: extractedData.distance || null,
            pickup_date: extractedData.pickupDate || null,
            page_url: window.location.href,
            user_name: 'Closer Extension', // Closer extension identifier
            chrome_profile_name: 'Closer Extension',
            status: status,
            submitted_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            // Include payment information if provided
            payment_amount: extractedData.paymentAmount ? parseFloat(extractedData.paymentAmount) : null,
            payment_method: extractedData.paymentMethod || null,
            payment_status: extractedData.paymentStatus || null
        };

        const response = await fetch(`${SUPABASE_URL}/rest/v1/job_submissions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(submissionData)
        });

        if (response.ok) {
            console.log('✅ Job submitted successfully to dashboard');
            
            // Send Slack notification for new job submission
            await sendSlackNotification(
                `🎯 New job submitted by CLOSER: ${submissionData.job_number}`,
                {
                    'Customer': submissionData.customer_name,
                    'From': submissionData.moving_from,
                    'To': submissionData.moving_to,
                    'Status': status,
                    'Submitted By': 'Closer Extension'
                }
            );
            
            return true;
        } else {
            const errorText = await response.text();
            console.error('❌ Failed to submit job:', response.status, errorText);
            return false;
        }
    } catch (error) {
        console.error('❌ Error submitting job to dashboard:', error);
        return false;
    }
}

// Page Analyzer Class
class PageAnalyzer {
    constructor() {
        this.extractedData = null;
    }

    analyzePage() {
        console.log('Starting page analysis...');
        
        // Extract text content from the page
        const textContent = document.body.innerText || document.body.textContent || '';
        console.log('Extracting from text content:', textContent.substring(0, 200) + '...');
        
        // Split content into sections
        const sections = textContent.split('\n').filter(line => line.trim().length > 0);
        console.log('Split sections:', sections);
        
        // Look for moving details
        const movingDetails = this.extractMovingDetails();
        console.log('Moving details extracted:', movingDetails);
        
        this.extractedData = movingDetails;
        return movingDetails;
    }

    extractMovingDetails() {
        const details = {
            jobNumber: this.extractJobNumber(),
            customerName: this.extractCustomerName(),
            movingFrom: this.extractMovingFrom(),
            movingTo: this.extractMovingTo(),
            cubes: this.extractCubes(),
            distance: this.extractDistance(),
            pickupDate: this.extractPickupDate()
        };

        console.log('Final extracted data:', details);
        return details;
    }

    extractJobNumber() {
        // Try to find job number in various formats
        const jobNumberRegex = /(?:Job|Job\s*#?|Job\s*No:?)\s*([A-Z0-9]+)/i;
        const match = document.body.innerText.match(jobNumberRegex);
        
        if (match) {
            console.log('Job number extracted:', match[1]);
            return match[1];
        }

        // Try to find in specific elements
        const jobElements = document.querySelectorAll('input, td, span, div');
        for (const element of jobElements) {
            const text = element.textContent || element.value || '';
            const jobMatch = text.match(jobNumberRegex);
            if (jobMatch) {
                console.log('Job number extracted from element:', jobMatch[1]);
                return jobMatch[1];
            }
        }

        return null;
    }

    extractCustomerName() {
        // Look for customer name patterns
        const namePatterns = [
            /Customer:\s*([^\n\r]+)/i,
            /Name:\s*([^\n\r]+)/i,
            /Client:\s*([^\n\r]+)/i
        ];

        const text = document.body.innerText;
        for (const pattern of namePatterns) {
            const match = text.match(pattern);
            if (match) {
                console.log('Customer name extracted:', match[1].trim());
                return match[1].trim();
            }
        }

        return null;
    }

    extractMovingFrom() {
        // Look for "Moving From" section
        const text = document.body.innerText;
        const fromMatch = text.match(/Moving From[:\s]*(.+?)(?=Moving To|$)/is);
        
        if (fromMatch) {
            console.log('Found Moving From section:', fromMatch[1].substring(0, 100));
            
            const fromText = fromMatch[1];
            const addressMatch = fromText.match(/([^\n\r]+(?:\n\r?[^\n\r]+){0,3})/);
            
            if (addressMatch) {
                const address = addressMatch[1].trim().replace(/\s+/g, ' ');
                console.log('Moving From extracted:', address);
                return { address: address };
            }
        }

        return null;
    }

    extractMovingTo() {
        // Look for "Moving To" section
        const text = document.body.innerText;
        const toMatch = text.match(/Moving To[:\s]*(.+?)(?=Initial Price|Total|$)/is);
        
        if (toMatch) {
            console.log('Found Moving To section:', toMatch[1].substring(0, 100));
            
            const toText = toMatch[1];
            const addressMatch = toText.match(/([^\n\r]+(?:\n\r?[^\n\r]+){0,3})/);
            
            if (addressMatch) {
                const address = addressMatch[1].trim().replace(/\s+/g, ' ');
                console.log('Moving To extracted:', address);
                return { address: address };
            }
        }

        return null;
    }

    extractCubes() {
        // Look for cube information
        const cubePatterns = [
            /(\d+)\s*cf/i,
            /(\d+)\s*cubic\s*feet/i,
            /Cubes?:\s*(\d+)/i
        ];

        const text = document.body.innerText;
        for (const pattern of cubePatterns) {
            const match = text.match(pattern);
            if (match) {
                console.log('Cubes extracted:', match[1]);
                return parseInt(match[1]);
            }
        }

        // Try to find in specific input fields
        const cubeInputs = document.querySelectorAll('input[name*="cube"], input[id*="cube"], input[class*="cube"]');
        for (const input of cubeInputs) {
            if (input.value && !isNaN(input.value)) {
                console.log('Cubes extracted from input:', input.value);
                return parseInt(input.value);
            }
        }

        return null;
    }

    extractDistance() {
        // Look for distance information
        const distancePatterns = [
            /(\d+)\s*miles/i,
            /Distance:\s*(\d+)/i
        ];

        const text = document.body.innerText;
        for (const pattern of distancePatterns) {
            const match = text.match(pattern);
            if (match) {
                console.log('Distance extracted:', match[1]);
                return parseInt(match[1]);
            }
        }

        return null;
    }

    extractPickupDate() {
        // Look for pickup date information
        const datePatterns = [
            /Pickup[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
            /Pick[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
            /Move[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i
        ];

        const text = document.body.innerText;
        for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match) {
                console.log('Pickup date extracted:', match[1]);
                return match[1];
            }
        }

        return null;
    }

    analyzeMovingCompanyPage() {
        // Look for specific moving company page elements
        const fromToCells = document.querySelectorAll('td, div, span');
        console.log('Found FROMTO cells:', fromToCells.length);
        
        let movingFrom = null;
        let movingTo = null;
        let cubes = null;
        let pickupDate = null;

        fromToCells.forEach((cell, index) => {
            const text = cell.textContent.trim();
            
            if (text.includes('Moving From') || text.includes('FROM')) {
                console.log('Moving From extracted:', text);
                movingFrom = { address: text };
            }
            
            if (text.includes('Moving To') || text.includes('TO')) {
                console.log('Moving To extracted:', text);
                movingTo = { address: text };
            }
            
            // Look for cubes in the same cell or nearby
            const cubeMatch = text.match(/(\d+)\s*cf/i);
            if (cubeMatch) {
                console.log('Cubes extracted from CFLBS input:', cubeMatch[1]);
                cubes = parseInt(cubeMatch[1]);
            }
            
            // Look for pickup date
            const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
            if (dateMatch) {
                console.log('Pickup date extracted from PUDTE input:', dateMatch[1]);
                pickupDate = dateMatch[1];
            }
        });

        if (movingFrom || movingTo || cubes || pickupDate) {
            console.log('Moving details extracted:', { movingFrom, movingTo, cubes, pickupDate });
            this.extractedData = {
                ...this.extractedData,
                movingFrom,
                movingTo,
                cubes,
                pickupDate
            };
        }

        return this.extractedData;
    }
}

// Check if current page is HelloMoving pricing page
function isHelloMovingPricingPage() {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    
    console.log('🔍 Page detection results:');
    console.log('- Current URL:', window.location.href);
    console.log('- Hostname:', hostname);
    console.log('- Is HelloMoving domain:', hostname.includes('hellomoving'));
    console.log('- Is pricing page:', pathname.includes('charge') || pathname.includes('estimate'));
    console.log('- Should load overlays:', hostname.includes('hellomoving') && (pathname.includes('charge') || pathname.includes('estimate')));
    
    return hostname.includes('hellomoving') && (pathname.includes('charge') || pathname.includes('estimate'));
}

// Check if current page is HelloMoving payment page
function isHelloMovingPaymentPage() {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    
    return hostname.includes('hellomoving') && (pathname.includes('payment') || pathname.includes('pay'));
}

// Function to create and show the multi-button status overlay
function createSubmitButtonOverlay() {
    console.log('🔧 Creating multi-button status overlay (CLOSER VERSION)...');
    
    // Remove existing overlay if it exists
    const existingOverlay = document.getElementById('submit-button-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'submit-button-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: rgba(255, 255, 255, 0.95);
        border: 2px solid #007bff;
        border-radius: 12px;
        padding: 15px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        min-width: 200px;
        backdrop-filter: blur(10px);
    `;

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
        font-weight: bold;
        color: #007bff;
        margin-bottom: 12px;
        text-align: center;
        font-size: 14px;
        border-bottom: 1px solid #e0e0e0;
        padding-bottom: 8px;
    `;
    header.textContent = '🎯 CLOSER Job Tracker';
    overlay.appendChild(header);

    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 160px;
    `;
    
    // Use the predefined closer status buttons
    
    // Create buttons
    statusButtons.forEach(buttonConfig => {
        const button = document.createElement('div');
        button.style.cssText = `
            background: ${buttonConfig.color};
            color: white;
            border: none;
            border-radius: 8px;
            padding: 10px 12px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            text-align: center;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        `;
        
        button.innerHTML = `
            <span style="font-size: 16px;">${buttonConfig.emoji}</span>
            <span>${buttonConfig.text}</span>
        `;
        
        // Add hover effect
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
        });
        
        button.addEventListener('click', async () => {
            console.log(`🎯 ${buttonConfig.text} button clicked`);
            
            // Disable button temporarily
            button.style.opacity = '0.6';
            button.style.cursor = 'not-allowed';
            
            try {
                // Get current extracted data
                const analyzer = new PageAnalyzer();
                analyzer.analyzePage();
                analyzer.analyzeMovingCompanyPage();
                
                const extractedData = analyzer.extractedData;
                
                if (!extractedData || (!extractedData.jobNumber && !extractedData.customerName)) {
                    console.warn('⚠️ No job data extracted, using basic info');
                    extractedData = {
                        jobNumber: 'CLOSER-' + Date.now(),
                        customerName: 'Unknown Customer',
                        movingFrom: { address: 'Unknown' },
                        movingTo: { address: 'Unknown' },
                        pageUrl: window.location.href
                    };
                }
                
                console.log('📊 Submitting with data:', extractedData);
                
                const success = await submitJobToDashboard(buttonConfig.status, extractedData);
                
                if (success) {
                    // Show success feedback
                    button.style.background = '#28a745';
                    button.innerHTML = `
                        <span style="font-size: 16px;">✅</span>
                        <span>Submitted!</span>
                    `;
                    
                    // Reset after 2 seconds
                    setTimeout(() => {
                        button.style.background = buttonConfig.color;
                        button.innerHTML = `
                            <span style="font-size: 16px;">${buttonConfig.emoji}</span>
                            <span>${buttonConfig.text}</span>
                        `;
                        button.style.opacity = '1';
                        button.style.cursor = 'pointer';
                    }, 2000);
                } else {
                    // Show error feedback
                    button.style.background = '#dc3545';
                    button.innerHTML = `
                        <span style="font-size: 16px;">❌</span>
                        <span>Failed!</span>
                    `;
                    
                    // Reset after 2 seconds
                    setTimeout(() => {
                        button.style.background = buttonConfig.color;
                        button.innerHTML = `
                            <span style="font-size: 16px;">${buttonConfig.emoji}</span>
                            <span>${buttonConfig.text}</span>
                        `;
                        button.style.opacity = '1';
                        button.style.cursor = 'pointer';
                    }, 2000);
                }
            } catch (error) {
                console.error('❌ Error handling button click:', error);
                
                // Show error feedback
                button.style.background = '#dc3545';
                button.innerHTML = `
                    <span style="font-size: 16px;">❌</span>
                    <span>Error!</span>
                `;
                
                // Reset after 2 seconds
                setTimeout(() => {
                    button.style.background = buttonConfig.color;
                    button.innerHTML = `
                        <span style="font-size: 16px;">${buttonConfig.emoji}</span>
                        <span>${buttonConfig.text}</span>
                    `;
                    button.style.opacity = '1';
                    button.style.cursor = 'pointer';
                }, 2000);
            }
        });
        
        buttonsContainer.appendChild(button);
    });

    overlay.appendChild(buttonsContainer);

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
        position: absolute;
        top: 5px;
        right: 8px;
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #666;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
    `;
    closeButton.addEventListener('click', () => {
        overlay.remove();
    });
    overlay.appendChild(closeButton);

    // Add to page
    document.body.appendChild(overlay);
    console.log('✅ Multi-button status overlay created and displayed (CLOSER VERSION)');
}

// Function to create security monitoring overlay
function createSecurityOverlay() {
    console.log('🔧 Creating security monitoring overlay (CLOSER VERSION)...');
    
    // Remove existing overlay if it exists
    const existingOverlay = document.getElementById('security-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // Create security overlay
    const securityOverlay = document.createElement('div');
    securityOverlay.id = 'security-overlay';
    securityOverlay.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        z-index: 9999;
        background: rgba(220, 53, 69, 0.9);
        color: white;
        padding: 10px 15px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        border: 2px solid #dc3545;
    `;
    
    securityOverlay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">🛡️</span>
            <span>CLOSER Security Active</span>
        </div>
        <div style="font-size: 10px; margin-top: 4px; opacity: 0.8;">
            Job tracking & monitoring enabled
        </div>
    `;

    // Add to page
    document.body.appendChild(securityOverlay);
    console.log('✅ Security monitoring overlay created and displayed (CLOSER VERSION)');
}

// Function to create HelloMoving payment overlay
function createHelloMovingPaymentOverlay() {
    console.log('🔧 Creating HelloMoving payment overlay (CLOSER VERSION)...');
    
    // Remove existing overlay if it exists
    const existingOverlay = document.getElementById('elavon-payment-button');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // Create payment button
    const paymentButton = document.createElement('div');
    paymentButton.id = 'elavon-payment-button';
    paymentButton.style.cssText = `
        position: fixed;
        top: 50%;
        right: 20px;
        transform: translateY(-50%);
        z-index: 10000;
        background: linear-gradient(135deg, #28a745, #20c997);
        color: white;
        padding: 15px 20px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
        transition: all 0.3s ease;
        text-align: center;
        min-width: 140px;
        border: 2px solid #28a745;
    `;
    
    paymentButton.innerHTML = `
        <div style="font-size: 18px; margin-bottom: 5px;">💳</div>
        <div>CLOSER Payment Capture</div>
        <div style="font-size: 10px; opacity: 0.8; margin-top: 4px;">
            Track payment details
        </div>
    `;

    // Add hover effect
    paymentButton.addEventListener('mouseenter', () => {
        paymentButton.style.transform = 'translateY(-50%) scale(1.05)';
        paymentButton.style.boxShadow = '0 8px 25px rgba(40, 167, 69, 0.6)';
    });

    paymentButton.addEventListener('mouseleave', () => {
        paymentButton.style.transform = 'translateY(-50%) scale(1)';
        paymentButton.style.boxShadow = '0 6px 20px rgba(40, 167, 69, 0.4)';
    });

    // Add click handler
    paymentButton.addEventListener('click', async () => {
        console.log('💳 Payment capture button clicked (CLOSER VERSION)');
        
        // Get current extracted data
        const analyzer = new PageAnalyzer();
        analyzer.analyzePage();
        analyzer.analyzeMovingCompanyPage();
        
        const extractedData = analyzer.extractedData || {};
        
        // Submit as payment captured status
        const success = await submitJobToDashboard('payment_captured', {
            ...extractedData,
            paymentAmount: null, // Use null instead of string for numeric field
            paymentMethod: 'Credit Card'
        });
        
        if (success) {
            // Show success feedback
            paymentButton.innerHTML = `
                <div style="font-size: 18px; margin-bottom: 5px;">✅</div>
                <div>Payment Captured!</div>
                <div style="font-size: 10px; opacity: 0.8; margin-top: 4px;">
                    Sent to dashboard
                </div>
            `;
            
            setTimeout(() => {
                paymentButton.innerHTML = `
                    <div style="font-size: 18px; margin-bottom: 5px;">💳</div>
                    <div>CLOSER Payment Capture</div>
                    <div style="font-size: 10px; opacity: 0.8; margin-top: 4px;">
                        Track payment details
                    </div>
                `;
            }, 3000);
        }
    });

    // Add to page
    document.body.appendChild(paymentButton);
    console.log('✅ HelloMoving payment overlay created and displayed (CLOSER VERSION)');
}

// Also analyze the page when it loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page Price Analyzer content script loaded (CLOSER VERSION)');
    console.log('Current page URL:', window.location.href);
    
    // Always run the analyzer (for data extraction)
    const analyzer = new PageAnalyzer();
    analyzer.analyzePage();
    analyzer.analyzeMovingCompanyPage();
    
    // Always create overlays on HelloMoving.com pricing pages (CLOSER EXTENSION)
    if (isHelloMovingPricingPage()) {
        console.log('✅ HelloMoving pricing page detected - creating CLOSER overlays');
        
        // Create the persistent submit button overlay
        createSubmitButtonOverlay();
        
        // Create the security monitoring overlay
        console.log('About to create security overlay...');
        createSecurityOverlay();
    } else if (isHelloMovingPaymentPage()) {
        console.log('✅ HelloMoving payment page detected - creating payment overlay');
        
        // Create payment overlay directly (no need to load external script)
        createHelloMovingPaymentOverlay();
    } else {
        console.log('❌ Not a HelloMoving pricing or payment page - skipping overlay creation');
        console.log('Overlays will not be shown on this page');
    }
});

// Also run when window loads (for pages that load content dynamically)
window.addEventListener('load', () => {
    console.log('Page Price Analyzer content script - window loaded (CLOSER VERSION)');
    const analyzer = new PageAnalyzer();
    analyzer.analyzePage();
    analyzer.analyzeMovingCompanyPage();
    
    // Always create overlays on HelloMoving.com pricing pages (CLOSER EXTENSION)
    if (isHelloMovingPricingPage()) {
        console.log('✅ HelloMoving pricing page detected - ensuring CLOSER overlays exist');
        
        // Ensure submit button overlay is created
        if (!document.getElementById('submit-button-overlay')) {
            createSubmitButtonOverlay();
        }
        
        // Ensure security overlay is created
        if (!document.getElementById('security-overlay')) {
            console.log('Creating security overlay on window load...');
            createSecurityOverlay();
        }
    } else if (isHelloMovingPaymentPage()) {
        console.log('✅ HelloMoving payment page detected - ensuring payment overlay exists');
        
        // Ensure payment overlay is created
        if (!document.getElementById('elavon-payment-button')) {
            createHelloMovingPaymentOverlay();
        }
    } else {
        console.log('❌ Not a HelloMoving pricing or payment page - skipping overlay creation on window load');
    }
});

// No need for storage listeners in the closer extension - overlays always show

// Listen for dynamic content changes
const observer = new MutationObserver(() => {
    // Re-analyze if content changes significantly
    const analyzer = new PageAnalyzer();
    analyzer.analyzePage();
    analyzer.analyzeMovingCompanyPage();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Manual function to test overlay creation (for debugging)
window.testCreateOverlays = function() {
    console.log('🧪 Manual test: Creating CLOSER overlays...');
    console.log('Current URL:', window.location.href);
    console.log('Is HelloMoving pricing page:', isHelloMovingPricingPage());
    
    createSubmitButtonOverlay();
    createSecurityOverlay();
    console.log('✅ Manual CLOSER overlay creation completed');
};

console.log('🎯 CLOSER Chrome Extension content script loaded successfully');
