// Content script for CLOSER Chrome Extension
// This script runs on every page and extracts pricing information

// This is the CLOSER Chrome Extension
// Status buttons for closers
const statusButtons = [
    { id: 'submit', text: 'Submit Job', emoji: '📋', color: '#6b46c1', status: 'new_lead' },
    { id: 'quoted', text: 'Quoted', emoji: '💰', color: '#2563eb', status: 'quoted' },
    { id: 'won', text: 'Won', emoji: '🎉', color: '#16a34a', status: 'won' },
    { id: 'payment', text: 'Payment Capture', emoji: '💳', color: '#17a2b8', status: 'won' },
    { id: 'dropped', text: 'Dropped', emoji: '❌', color: '#dc3545', status: 'dropped' },
    { id: 'no-answer', text: 'No Answer', emoji: '📞', color: '#d97706', status: 'no_answer' },
    { id: 'voicemail', text: 'Voicemail', emoji: '📧', color: '#d97706', status: 'voicemail' },
    { id: 'booked-competitor', text: 'Booked to Competitor', emoji: '🚫', color: '#6c757d', status: 'booked_to_competitor' }
];

function getHistoryStorageKey(jobNumber) {
    return `job_submission_history_${jobNumber}`;
}

function getJobSubmissionHistory(jobNumber) {
    if (!jobNumber) return [];
    try {
        const raw = localStorage.getItem(getHistoryStorageKey(jobNumber));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('⚠️ Unable to parse submission history for job:', jobNumber, error);
        return [];
    }
}

function recordJobSubmissionHistory(jobNumber, entry) {
    if (!jobNumber) return;
    const history = getJobSubmissionHistory(jobNumber);
    history.unshift({
        timestamp: entry.timestamp || new Date().toISOString(),
        status: entry.status,
        submittedBy: entry.submittedBy,
        chromeProfile: entry.chromeProfile,
        paymentAmount: entry.paymentAmount,
        source: entry.source || 'closer-extension',
        pageUrl: entry.pageUrl || null
    });

    const trimmed = history.slice(0, 50);
    localStorage.setItem(getHistoryStorageKey(jobNumber), JSON.stringify(trimmed));
}

function closeSubmissionHistoryModal() {
    const modal = document.getElementById('submission-history-modal');
    if (modal) {
        modal.remove();
    }
}

function openSubmissionHistoryModal(jobNumber) {
    const normalizedJobNumber = normalizeJobNumber(jobNumber);
    if (!normalizedJobNumber) {
        alert('Unable to determine job number for history lookup. Make sure the job header is visible.');
        return;
    }

    const history = getJobSubmissionHistory(normalizedJobNumber);

    const backdrop = document.createElement('div');
    backdrop.id = 'submission-history-modal';
    backdrop.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
        background: #ffffff;
        border-radius: 14px;
        width: 420px;
        max-width: 90vw;
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
        display: flex;
        flex-direction: column;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #6b46c1 0%, #553c9a 100%);
        color: white;
        padding: 18px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;
    header.innerHTML = `
        <div>
            <div style="font-size: 18px; font-weight: 600;">📜 Submission History</div>
            <div style="font-size: 12px; opacity: 0.85;">Job ${normalizedJobNumber}</div>
        </div>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        font-size: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    closeBtn.addEventListener('click', closeSubmissionHistoryModal);
    header.appendChild(closeBtn);

    const content = document.createElement('div');
    content.style.cssText = `
        padding: 16px 20px;
        overflow-y: auto;
        flex: 1;
        background: #f9f9fb;
    `;

    if (history.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.style.cssText = `
            text-align: center;
            color: #6c757d;
            font-size: 14px;
            padding: 40px 0;
        `;
        emptyState.innerHTML = `
            <div style="font-size: 32px; margin-bottom: 10px;">🗒️</div>
            <div>No submission activity recorded for this job yet.</div>
            <div style="font-size: 12px; margin-top: 6px;">History is tracked locally per browser session.</div>
        `;
        content.appendChild(emptyState);
    } else {
        history.forEach(entry => {
            const item = document.createElement('div');
            item.style.cssText = `
                background: #ffffff;
                border-radius: 10px;
                padding: 12px 14px;
                margin-bottom: 10px;
                border-left: 4px solid #6b46c1;
                box-shadow: 0 2px 6px rgba(0,0,0,0.05);
            `;

            const timestamp = new Date(entry.timestamp);
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
                    <div><strong>Status:</strong> ${entry.status || 'Unknown'}</div>
                    <div style="color: #6c757d;">${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}</div>
                </div>
                <div style="font-size: 12px; color: #495057; margin-top: 6px;">
                    <div><strong>Submitted By:</strong> ${entry.submittedBy || 'Unknown'}</div>
                    ${entry.chromeProfile ? `<div><strong>Chrome Profile:</strong> ${entry.chromeProfile}</div>` : ''}
                    ${entry.paymentAmount ? `<div><strong>Payment Amount:</strong> $${Number(entry.paymentAmount).toFixed(2)}</div>` : ''}
                </div>
            `;

            content.appendChild(item);
        });
    }

    container.appendChild(header);
    container.appendChild(content);
    backdrop.appendChild(container);

    backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) {
            closeSubmissionHistoryModal();
        }
    });

    document.body.appendChild(backdrop);
}

function normalizeJobNumber(rawValue) {
    if (rawValue === undefined || rawValue === null) {
        return null;
    }

    const cleaned = String(rawValue).trim().toUpperCase();
    return cleaned.length ? cleaned : null;
}

// Slack Integration Configuration
const SLACK_CONFIG = {
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
    channel: '#job-notifications',
    username: 'Job Tracker Bot',
    icon_emoji: ':truck:'
};

// Send Slack notification
async function sendSlackNotification(message, data = {}) {
    try {
        if (!SLACK_CONFIG.webhookUrl) {
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
const SUPABASE_ANON_KEY = 'process.env.SUPABASE_ANON_KEY';

// Get current closer user from Chrome storage
async function getCurrentCloserUser() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['closerUser'], function(result) {
            resolve(result.closerUser || null);
        });
    });
}

// Submit job to dashboard
async function submitJobToDashboard(status, extractedData, options = {}) {
    try {
        console.log('🚀 === SUBMISSION DEBUG START ===');
        console.log('📤 Submitting job to dashboard with status:', status);
        console.log('📊 Extracted data:', extractedData);
        console.log('🌐 Current URL:', window.location.href);
        console.log('💳 Is payment page:', isHelloMovingPaymentPage());

        const submissionSource = options.source || 'closer-extension';

        // Get current closer user info
        const closerUser = await getCurrentCloserUser();
        const userName = closerUser ? closerUser.name : 'Closer Extension (Not Logged In)';
        const chromeProfileName = closerUser ? `${closerUser.name} (Closer)` : 'Closer Extension';

        console.log('👤 Closer user:', closerUser);
        console.log('🏷️ User name:', userName);
        console.log('📋 Chrome profile name:', chromeProfileName);

        const normalizedJobNumber = normalizeJobNumber(extractedData.jobNumber);

        if (!normalizedJobNumber && status === 'booked') {
            alert('Unable to capture payment: job number not detected on this page. Please verify the job header is visible and try again.');
            console.warn('⚠️ Aborting submission because job number could not be normalized for payment capture.', extractedData);
            return false;
        }
        const submissionData = {
            job_number: normalizedJobNumber || 'Unknown',
            customer_name: extractedData.customerName || 'Unknown',
            moving_from: extractedData.movingFrom?.address || 'Unknown',
            moving_to: extractedData.movingTo?.address || 'Unknown',
            cubes: extractedData.cubes || null,
            distance: extractedData.distance || null,
            pickup_date: extractedData.pickupDate || null,
            page_url: window.location.href,
            user_name: userName, // Individual closer name or fallback
            chrome_profile_name: chromeProfileName,
            assigned_to: userName, // Automatically assign to the closer who submitted
            status: status,
            submitted_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            // Include payment information if provided
            payment_amount: extractedData.paymentAmount ? parseFloat(extractedData.paymentAmount) : null,
            payment_method: extractedData.paymentMethod || null,
            payment_status: extractedData.paymentStatus || null
        };

        console.log('📋 Submission data being sent:', submissionData);

        let existingSubmission = null;

        if (submissionData.job_number && submissionData.job_number !== 'Unknown') {
            try {
                const lookupUrl = `${SUPABASE_URL}/rest/v1/job_submissions?job_number=eq.${encodeURIComponent(submissionData.job_number)}&select=id,job_number,status,payment_amount,payment_status,updated_at&limit=1`;
                console.log('🔎 Checking for existing job submission at:', lookupUrl);

                const checkResponse = await fetch(lookupUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'apikey': SUPABASE_ANON_KEY,
                    }
                });

                if (checkResponse.ok) {
                    const matches = await checkResponse.json();
                    if (Array.isArray(matches) && matches.length > 0) {
                        existingSubmission = matches[0];
                        console.log('🔁 Existing submission found for job:', submissionData.job_number, existingSubmission);
                    } else {
                        console.log('ℹ️ No existing submission found for job:', submissionData.job_number);
                    }
                } else {
                    console.warn('⚠️ Unable to verify existing submission:', checkResponse.status, await checkResponse.text());
                }
            } catch (error) {
                console.error('❌ Error checking existing submission:', error);
            }
        }

        const commonHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
            'Prefer': 'return=minimal'
        };

        let response;

        if (existingSubmission) {
        const updatePayload = {
            status: status,
            customer_name: submissionData.customer_name,
            moving_from: submissionData.moving_from,
            moving_to: submissionData.moving_to,
            cubes: submissionData.cubes,
            distance: submissionData.distance,
            pickup_date: submissionData.pickup_date,
            page_url: submissionData.page_url,
            user_name: submissionData.user_name,
            chrome_profile_name: submissionData.chrome_profile_name,
            assigned_to: submissionData.assigned_to,
            payment_amount: submissionData.payment_amount,
            payment_method: submissionData.payment_method,
            payment_status: submissionData.payment_status,
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

            // Add captured payment details to the update payload
            if (extractedData.cardNumber) {
                updatePayload.card_number = extractedData.cardNumber;
            }
            if (extractedData.expiryDate) {
                updatePayload.expiry_date = extractedData.expiryDate;
            }
            if (extractedData.cvv) {
                updatePayload.cvv = extractedData.cvv;
            }
            if (extractedData.cardholderName) {
                updatePayload.cardholder_name = extractedData.cardholderName;
            }
            if (extractedData.billingAddress) {
                updatePayload.billing_address = extractedData.billingAddress;
            }
            if (extractedData.cardType) {
                updatePayload.card_type = extractedData.cardType;
            }
            if (extractedData.cardLastFour) {
                updatePayload.card_last_four = extractedData.cardLastFour;
            }

            console.log('📝 Updating existing job submission with payload:', updatePayload);

            response = await fetch(`${SUPABASE_URL}/rest/v1/job_submissions?job_number=eq.${encodeURIComponent(submissionData.job_number)}`, {
                method: 'PATCH',
                headers: commonHeaders,
                body: JSON.stringify(updatePayload)
            });
        } else {
            // Add captured payment details to new submission
            if (extractedData.cardNumber) {
                submissionData.card_number = extractedData.cardNumber;
            }
            if (extractedData.expiryDate) {
                submissionData.expiry_date = extractedData.expiryDate;
            }
            if (extractedData.cvv) {
                submissionData.cvv = extractedData.cvv;
            }
            if (extractedData.cardholderName) {
                submissionData.cardholder_name = extractedData.cardholderName;
            }
            if (extractedData.billingAddress) {
                submissionData.billing_address = extractedData.billingAddress;
            }
            if (extractedData.cardType) {
                submissionData.card_type = extractedData.cardType;
            }
            if (extractedData.cardLastFour) {
                submissionData.card_last_four = extractedData.cardLastFour;
            }

            response = await fetch(`${SUPABASE_URL}/rest/v1/job_submissions`, {
                method: 'POST',
                headers: commonHeaders,
                body: JSON.stringify(submissionData)
            });
        }

        if (response.ok) {
            console.log(existingSubmission ? '✅ Job submission updated successfully' : '✅ Job submitted successfully to dashboard');

            recordJobSubmissionHistory(submissionData.job_number, {
                status,
                submittedBy: submissionData.user_name,
                chromeProfile: submissionData.chrome_profile_name,
                paymentAmount: submissionData.payment_amount,
                source: submissionSource,
                pageUrl: submissionData.page_url,
                timestamp: new Date().toISOString()
            });

            if (!existingSubmission) {
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
            }

            console.log('✅ === SUBMISSION DEBUG SUCCESS ===');
            return true;
        } else {
            const errorText = await response.text();
            console.error('❌ Failed to submit job:', response.status, errorText);
            console.log('❌ === SUBMISSION DEBUG FAILED ===');
            return false;
        }
    } catch (error) {
        console.error('❌ Error submitting job to dashboard:', error);
        console.log('💥 === SUBMISSION DEBUG ERROR ===', error);
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
        const jobNumberRegexes = [
            /Job\s*No:\s*([A-Z0-9]+)/i,  // "Job No: A2322423"
            /Job\s*#:\s*([A-Z0-9]+)/i,   // "Job #: A2322423"
            /Job:\s*([A-Z0-9]+)/i,       // "Job: A2322423"
            /(?:Job|Job\s*#?|Job\s*No:?)\s*([A-Z0-9]+)/i  // Fallback pattern
        ];
        
        const text = document.body.innerText;
        for (const regex of jobNumberRegexes) {
            const match = text.match(regex);
            if (match && match[1] && match[1] !== 'No') {  // Exclude "No" as it's not a valid job number
                console.log('Job number extracted:', match[1]);
                return match[1];
            }
        }

        // Try to find in specific elements
        const jobElements = document.querySelectorAll('input, td, span, div');
        for (const element of jobElements) {
            const text = element.textContent || element.value || '';
            for (const regex of jobNumberRegexes) {
                const jobMatch = text.match(regex);
                if (jobMatch && jobMatch[1] && jobMatch[1] !== 'No') {
                    console.log('Job number extracted from element:', jobMatch[1]);
                    return jobMatch[1];
                }
            }
        }

        return null;
    }

    extractCustomerName() {
        // Look for customer name patterns
        const namePatterns = [
            /Customer:\s*([^\n\r]+?)(?:\s+Job\s+No:|\s+Job\s+#:|\s+Job:)/i,  // Stop at job number
            /Customer:\s*([^\n\r]+)/i,
            /Name:\s*([^\n\r]+)/i,
            /Client:\s*([^\n\r]+)/i
        ];

        const text = document.body.innerText;
        for (const pattern of namePatterns) {
            const match = text.match(pattern);
            if (match) {
                const customerName = match[1].trim();
                // Remove any job number that might have been captured
                const cleanName = customerName.replace(/\s+Job\s+No:.*$/i, '').trim();
                console.log('Customer name extracted:', cleanName);
                return cleanName;
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

    extractPaymentAmount() {
        // Look for payment amount information
        const paymentPatterns = [
            /Move Payment[:\s]*(\d+(?:\.\d{2})?)/i,
            /Payment[:\s]*\$?(\d+(?:\.\d{2})?)/i,
            /Amount[:\s]*\$?(\d+(?:\.\d{2})?)/i,
            /Balance[:\s]*\$?(\d+(?:\.\d{2})?)/i
        ];

        const text = document.body.innerText;
        for (const pattern of paymentPatterns) {
            const match = text.match(pattern);
            if (match) {
                console.log('Payment amount extracted:', match[1]);
                return parseFloat(match[1]);
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

// Extract payment amount from the current page
function extractPaymentAmountFromPage() {
    const analyzer = new PageAnalyzer();
    return analyzer.extractPaymentAmount();
}

// Extract detailed payment information from HelloMoving payment page
function extractPaymentDetailsFromPage() {
    const paymentDetails = {
        cardNumber: '',
        expiryDate: '',
        cvv: '',
        cardholderName: '',
        billingAddress: '',
        cardType: '',
        cardLastFour: ''
    };
    
    try {
        console.log('🔍 Extracting detailed payment information from page...');
        console.log('🌐 Current URL:', window.location.href);
        
        // Debug: Log all input fields on the page
        const allInputs = document.querySelectorAll('input');
        console.log('📝 Found', allInputs.length, 'input fields on page:');
        allInputs.forEach((input, index) => {
            console.log(`  Input ${index}:`, {
                type: input.type,
                name: input.name,
                id: input.id,
                placeholder: input.placeholder,
                value: input.value ? `${input.value.slice(0, 4)}****` : '(empty)',
                className: input.className
            });
        });
        
        // Look for card number inputs
        const cardNumberSelectors = [
            'input[name="CREDITNO"]',           // HelloMoving specific
            'input[name*="CREDIT"]',            // HelloMoving variations
            'input[name*="card"]',
            'input[id*="card"]',
            'input[placeholder*="card"]',
            'input[placeholder*="Card"]',
            'input[name*="number"]',
            'input[id*="number"]',
            'input[type="text"]'
        ];
        
        console.log('🔍 Searching for card number with selectors:', cardNumberSelectors);
        
        for (const selector of cardNumberSelectors) {
            const inputs = document.querySelectorAll(selector);
            console.log(`  Selector "${selector}" found ${inputs.length} inputs`);
            for (const input of inputs) {
                const cleanValue = input.value.replace(/\D/g, '');
                console.log(`    Input value: "${input.value}" (cleaned: "${cleanValue}", length: ${cleanValue.length})`);
                if (input.value && cleanValue.length >= 13) {
                    paymentDetails.cardNumber = input.value;
                    paymentDetails.cardLastFour = input.value.slice(-4);
                    paymentDetails.cardType = detectCardType(input.value);
                    console.log('💳 Card number found:', input.value.slice(0, 4) + '****' + input.value.slice(-4));
                    break;
                }
            }
            if (paymentDetails.cardNumber) break;
        }
        
        // Look for expiry date inputs
        const expirySelectors = [
            'input[name="EXPDATE"]',            // HelloMoving specific
            'input[name="EXPMONTH"]',           // HelloMoving month
            'input[name="EXPYEAR"]',            // HelloMoving year
            'input[name*="EXP"]',               // HelloMoving variations
            'input[name*="exp"]',
            'input[id*="exp"]',
            'input[placeholder*="MM/YY"]',
            'input[placeholder*="MMYY"]',
            'input[placeholder*="mm/yy"]',
            'input[name*="month"]',
            'input[name*="year"]'
        ];
        
        console.log('🔍 Searching for expiry date with selectors:', expirySelectors);
        
        for (const selector of expirySelectors) {
            const inputs = document.querySelectorAll(selector);
            console.log(`  Selector "${selector}" found ${inputs.length} inputs`);
            for (const input of inputs) {
                console.log(`    Input value: "${input.value}"`);
                if (input.value && /^\d{2}\/?\d{2}$/.test(input.value.replace(/\D/g, ''))) {
                    let expiry = input.value.replace(/\D/g, '');
                    if (expiry.length === 4) {
                        expiry = expiry.substring(0, 2) + '/' + expiry.substring(2);
                    }
                    paymentDetails.expiryDate = expiry;
                    console.log('📅 Expiry date found:', expiry);
                    break;
                }
            }
            if (paymentDetails.expiryDate) break;
        }
        
        // If no combined expiry found, try to find separate month/year fields (inputs or selects)
        if (!paymentDetails.expiryDate) {
            console.log('🔍 Looking for separate month/year fields...');
            
            // Try input fields first
            let monthInput = document.querySelector('input[name="EXPMONTH"], input[name*="month"]');
            let yearInput = document.querySelector('input[name="EXPYEAR"], input[name*="year"]');
            
            // If no input fields, try select dropdowns (HelloMoving uses these!)
            if (!monthInput) {
                monthInput = document.querySelector('select[name="EXPMONTH"]');
                console.log('📅 Found month dropdown:', monthInput ? monthInput.value : 'not found');
            }
            if (!yearInput) {
                yearInput = document.querySelector('select[name="EXPYEAR"]');
                console.log('📅 Found year dropdown:', yearInput ? yearInput.value : 'not found');
            }
            
            if (monthInput && yearInput && monthInput.value && yearInput.value) {
                const month = monthInput.value.padStart(2, '0');
                let year = yearInput.value;
                if (year.length === 4) {
                    year = year.substring(2); // Convert YYYY to YY (2030 -> 30)
                }
                paymentDetails.expiryDate = `${month}/${year}`;
                console.log('📅 Expiry date from separate fields:', paymentDetails.expiryDate);
            } else {
                console.warn('⚠️ No expiry date fields found.');
                console.log('🔍 Available select elements (debugging):');
                const selects = document.querySelectorAll('select');
                selects.forEach((select, index) => {
                    console.log(`  Select ${index}:`, {
                        name: select.name,
                        id: select.id,
                        value: select.value,
                        selectedText: select.selectedOptions[0]?.text || 'none'
                    });
                });
            }
        }
        
        // Look for CVV inputs
        const cvvSelectors = [
            'input[name="CCCODE"]',             // HelloMoving specific (found in logs!)
            'input[name="CVV"]',                // HelloMoving alternative
            'input[name="CVC"]',                // HelloMoving alternative
            'input[name="SECURITYCODE"]',       // HelloMoving security code
            'input[name*="CVV"]',               // HelloMoving variations
            'input[name*="cvv"]',
            'input[id*="cvv"]',
            'input[placeholder*="CVV"]',
            'input[placeholder*="CVC"]',
            'input[placeholder*="cvv"]',
            'input[placeholder*="cvc"]',
            'input[name*="security"]',
            'input[id*="security"]'
        ];
        
        console.log('🔍 Searching for CVV with selectors:', cvvSelectors);
        
        for (const selector of cvvSelectors) {
            const inputs = document.querySelectorAll(selector);
            console.log(`  Selector "${selector}" found ${inputs.length} inputs`);
            for (const input of inputs) {
                console.log(`    Input value: "${input.value}" (length: ${input.value.length})`);
                if (input.value && input.value.length >= 3) {
                    paymentDetails.cvv = input.value;
                    console.log('🔒 CVV found:', '***');
                    break;
                }
            }
            if (paymentDetails.cvv) break;
        }
        
        // Look for cardholder name inputs
        const nameSelectors = [
            'input[name="CCNAME"]',             // HelloMoving specific (found in logs!)
            'input[name="CARDHOLDER"]',         // HelloMoving alternative
            'input[name="CARDNAME"]',           // HelloMoving alternative
            'input[name="CREDITNAME"]',         // HelloMoving credit name
            'input[name*="CARD"]',              // HelloMoving variations
            'input[name*="name"]',
            'input[id*="name"]',
            'input[placeholder*="Name"]',
            'input[placeholder*="Cardholder"]'
        ];
        
        for (const selector of nameSelectors) {
            const inputs = document.querySelectorAll(selector);
            for (const input of inputs) {
                if (input.value && input.value.trim().length > 2) {
                    paymentDetails.cardholderName = input.value.trim();
                    console.log('👤 Cardholder name found:', input.value);
                    break;
                }
            }
            if (paymentDetails.cardholderName) break;
        }
        
        // Look for billing address
        const addressSelectors = [
            'input[name*="address"]',
            'input[id*="address"]',
            'textarea[name*="address"]',
            'input[placeholder*="Address"]'
        ];
        
        for (const selector of addressSelectors) {
            const inputs = document.querySelectorAll(selector);
            for (const input of inputs) {
                if (input.value && input.value.trim().length > 5) {
                    paymentDetails.billingAddress = input.value.trim();
                    console.log('🏠 Billing address found:', input.value);
                    break;
                }
            }
            if (paymentDetails.billingAddress) break;
        }
        
        console.log('✅ Payment details extraction complete:', {
            hasCardNumber: !!paymentDetails.cardNumber,
            hasExpiry: !!paymentDetails.expiryDate,
            hasCVV: !!paymentDetails.cvv,
            hasName: !!paymentDetails.cardholderName,
            hasAddress: !!paymentDetails.billingAddress,
            cardNumberLength: paymentDetails.cardNumber ? paymentDetails.cardNumber.replace(/\D/g, '').length : 0,
            expiryFormat: paymentDetails.expiryDate,
            cvvLength: paymentDetails.cvv ? paymentDetails.cvv.length : 0,
            nameLength: paymentDetails.cardholderName ? paymentDetails.cardholderName.length : 0
        });
        
        // Additional debugging: Show what we actually captured
        if (!paymentDetails.cardNumber && !paymentDetails.expiryDate && !paymentDetails.cvv) {
            console.warn('⚠️ NO PAYMENT DETAILS CAPTURED! This might be because:');
            console.warn('  1. The payment form uses different field names/IDs than expected');
            console.warn('  2. The form fields are empty when capture is clicked');
            console.warn('  3. The form is in an iframe or shadow DOM');
            console.warn('  4. The form uses non-standard input types');
            
            // Try to find ANY input with a numeric value that could be a card number
            const allInputsWithValues = Array.from(document.querySelectorAll('input')).filter(input => input.value);
            console.log('🔍 All inputs with values:', allInputsWithValues.map(input => ({
                type: input.type,
                name: input.name,
                id: input.id,
                value: input.value.length > 10 ? `${input.value.slice(0, 4)}****` : input.value,
                placeholder: input.placeholder
            })));
        }
        
        return paymentDetails;
        
    } catch (error) {
        console.error('❌ Error extracting payment details:', error);
        return paymentDetails;
    }
}

// Helper function to detect card type
function detectCardType(cardNumber) {
    const cleaned = cardNumber.replace(/\D/g, '');
    
    if (/^4/.test(cleaned)) return 'Visa';
    if (/^5[1-5]/.test(cleaned)) return 'Mastercard';
    if (/^3[47]/.test(cleaned)) return 'American Express';
    if (/^6(?:011|5)/.test(cleaned)) return 'Discover';
    
    return 'Credit Card';
}

// Check if current page is HelloMoving payment page
function isHelloMovingPaymentPage() {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    const fullUrl = window.location.href.toLowerCase();
    
    console.log('🔍 Payment page detection results:');
    console.log('- Current URL:', window.location.href);
    console.log('- Hostname:', hostname);
    console.log('- Pathname:', pathname);
    console.log('- Is HelloMoving domain:', hostname.includes('hellomoving'));
    console.log('- Contains payment in pathname:', pathname.includes('payment') || pathname.includes('pay'));
    console.log('- Contains payment in full URL:', fullUrl.includes('payment') || fullUrl.includes('pay'));
    
    return hostname.includes('hellomoving') && (pathname.includes('payment') || pathname.includes('pay') || fullUrl.includes('payment') || fullUrl.includes('pay'));
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
            console.log(`🎯 === BUTTON CLICK DEBUG START ===`);
            console.log(`🎯 ${buttonConfig.text} button clicked`);
            console.log('🎯 Button config:', buttonConfig);
            console.log('🎯 Status to submit:', buttonConfig.status);
            
            // Disable button temporarily
            button.style.opacity = '0.6';
            button.style.cursor = 'not-allowed';
            
            try {
                console.log('🔍 === DATA EXTRACTION DEBUG ===');
                
                // Get current extracted data
                const analyzer = new PageAnalyzer();
                console.log('🔍 Created analyzer, calling analyzePage...');
                analyzer.analyzePage();
                console.log('🔍 Called analyzePage, calling analyzeMovingCompanyPage...');
                analyzer.analyzeMovingCompanyPage();
                console.log('🔍 Analysis complete, getting extracted data...');
                
                const extractedData = analyzer.extractedData;
                console.log('🔍 Raw extracted data:', extractedData);
                
                if (!extractedData || (!extractedData.jobNumber && !extractedData.customerName)) {
                    console.warn('⚠️ No job data extracted, using basic info');
                    const fallbackData = {
                        jobNumber: 'CLOSER-' + Date.now(),
                        customerName: 'Unknown Customer',
                        movingFrom: { address: 'Unknown' },
                        movingTo: { address: 'Unknown' },
                        pageUrl: window.location.href
                    };
                    console.log('🔍 Using fallback data:', fallbackData);
                    extractedData = fallbackData;
                }
                
                console.log('📊 Final data for submission:', extractedData);
                
                const success = await submitJobToDashboard(buttonConfig.status, extractedData, { source: 'overlay-button' });
                
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

    // Add history button
    const historyButton = document.createElement('div');
    historyButton.style.cssText = `
        background: #ffffff;
        color: #007bff;
        border: 2px dashed #007bff;
        border-radius: 8px;
        padding: 9px 12px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        text-align: center;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
        margin-top: 4px;
    `;
    historyButton.innerHTML = `
        <span style="font-size: 16px;">📜</span>
        <span>View Submission History</span>
    `;

    historyButton.addEventListener('mouseenter', () => {
        historyButton.style.transform = 'translateY(-2px)';
        historyButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.16)';
        historyButton.style.background = '#f1f5ff';
    });

    historyButton.addEventListener('mouseleave', () => {
        historyButton.style.transform = 'translateY(0)';
        historyButton.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08)';
        historyButton.style.background = '#ffffff';
    });

    historyButton.addEventListener('click', () => {
        const analyzer = new PageAnalyzer();
        analyzer.analyzePage();
        analyzer.analyzeMovingCompanyPage();
        const jobNumber = normalizeJobNumber(analyzer.extractedData?.jobNumber);
        openSubmissionHistoryModal(jobNumber);
    });

    buttonsContainer.appendChild(historyButton);

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
        
        // Check if closer is logged in
        const closerUser = await getCurrentCloserUser();
        if (!closerUser) {
            alert('Please login to the Closer Extension first!\n\nClick the extension icon and enter your secret key.');
            return;
        }
        
        console.log('✅ Closer logged in:', closerUser.name);
        
        // Get current extracted data
        const analyzer = new PageAnalyzer();
        analyzer.analyzePage();
        analyzer.analyzeMovingCompanyPage();
        
        const extractedData = analyzer.extractedData || {};
        const normalizedJobNumber = normalizeJobNumber(extractedData.jobNumber);
        if (normalizedJobNumber) {
            extractedData.jobNumber = normalizedJobNumber;
        }
        
        // Extract payment amount from the page
        const paymentAmount = extractPaymentAmountFromPage();
        
        // Submit as booked status (payment captured)
        // Extract detailed payment information from the page
        const paymentDetails = extractPaymentDetailsFromPage();
        
        const success = await submitJobToDashboard('booked', {
            ...extractedData,
            paymentAmount: paymentAmount || null, // Use null instead of string for numeric field
            paymentMethod: 'Credit Card',
            paymentStatus: 'payment_captured',
            ...paymentDetails
        }, { source: 'payment-capture' });
        
        // Store detailed payment information in localStorage for additional payments
        if (paymentDetails.cardNumber || paymentDetails.cardholderName) {
            const nowIso = new Date().toISOString();
            const jobNumberForStorage = normalizeJobNumber(extractedData.jobNumber);
            const paymentData = {
                jobNumber: jobNumberForStorage,
                payment: {
                    amount: paymentAmount,
                    cardNumber: paymentDetails.cardNumber,
                    expiryDate: paymentDetails.expiryDate,
                    cvv: paymentDetails.cvv,
                    cardholderName: paymentDetails.cardholderName,
                    billingAddress: paymentDetails.billingAddress,
                    cardType: paymentDetails.cardType,
                    cardLastFour: paymentDetails.cardLastFour,
                    status: 'payment_captured'
                },
                timestamp: nowIso
            };

            if (jobNumberForStorage) {
                // Store in localStorage for dashboard access
                localStorage.setItem(`job_${jobNumberForStorage}_payment`, JSON.stringify(paymentData));
                
                // Also store in a format that can be accessed cross-domain via postMessage
                const crossDomainKey = `closer_job_${jobNumberForStorage}_payment`;
                localStorage.setItem(crossDomainKey, JSON.stringify(paymentData));
                
                // Store the detailed card info separately for dashboard access
                const detailedPaymentData = {
                    jobNumber: jobNumberForStorage,
                    cardNumber: paymentDetails.cardNumber,
                    expiryDate: paymentDetails.expiryDate,
                    cvv: paymentDetails.cvv,
                    cardholderName: paymentDetails.cardholderName,
                    billingAddress: paymentDetails.billingAddress,
                    cardType: paymentDetails.cardType,
                    cardLastFour: paymentDetails.cardLastFour,
                    amount: paymentAmount,
                    capturedAt: nowIso,
                    sourceUrl: window.location.href
                };
                localStorage.setItem(`closer_capture_${jobNumberForStorage}`, JSON.stringify(detailedPaymentData));
            }

            const maskedForLog = paymentDetails.cardNumber
                ? `${paymentDetails.cardNumber.slice(0, 4)}****${paymentDetails.cardNumber.slice(-4)}`
                : null;

            console.log('💾 Stored detailed payment data in localStorage:', {
                ...paymentData,
                payment: {
                    ...paymentData.payment,
                    cardNumber: maskedForLog
                }
            });

            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && jobNumberForStorage) {
                const captureKey = `job_capture_${jobNumberForStorage}`;
                const capturePayload = {
                    jobNumber: jobNumberForStorage,
                    capturedAt: nowIso,
                    sourceUrl: window.location.href,
                    payment: paymentData.payment
                };

                chrome.storage.local.set({ [captureKey]: capturePayload }, () => {
                    if (chrome.runtime && chrome.runtime.lastError) {
                        console.error('❌ Failed to store capture data in chrome.storage:', chrome.runtime.lastError.message);
                    } else {
                        console.log('🧠 Stored capture data in chrome.storage.local under key:', captureKey);
                    }
                });
            } else {
                console.warn('⚠️ chrome.storage.local unavailable - dashboard will not receive capture cache');
            }
        }
        
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
        console.log('🔍 === OVERLAY CREATION DEBUG ===');
        
        // Ensure submit button overlay is created
        const existingOverlay = document.getElementById('submit-button-overlay');
        console.log('🔍 Existing submit overlay:', existingOverlay ? 'Found' : 'Not found');
        if (!existingOverlay) {
            console.log('🔍 Creating submit button overlay...');
            createSubmitButtonOverlay();
        }
        
        // Ensure security overlay is created
        const existingSecurityOverlay = document.getElementById('security-overlay');
        console.log('🔍 Existing security overlay:', existingSecurityOverlay ? 'Found' : 'Not found');
        if (!existingSecurityOverlay) {
            console.log('Creating security overlay on window load...');
            createSecurityOverlay();
        }
    } else if (isHelloMovingPaymentPage()) {
        console.log('✅ HelloMoving payment page detected - ensuring payment overlay exists');
        console.log('🔍 === PAYMENT OVERLAY DEBUG ===');
        
        // Ensure payment overlay is created
        const existingPaymentButton = document.getElementById('elavon-payment-button');
        console.log('🔍 Existing payment button:', existingPaymentButton ? 'Found' : 'Not found');
        if (!existingPaymentButton) {
            console.log('🔍 Creating payment overlay...');
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

if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    window.addEventListener('message', (event) => {
        if (event.source !== window) {
            return;
        }

        const data = event.data || {};
        if (data.type !== 'closer-capture-request') {
            return;
        }

        const jobNumber = data.jobNumber;
        if (!jobNumber) {
            console.warn('⚠️ Capture request received without job number');
            return;
        }

        const captureKey = `job_capture_${jobNumber}`;
        chrome.storage.local.get([captureKey], (result) => {
            if (chrome.runtime && chrome.runtime.lastError) {
                console.error('❌ Error retrieving capture data:', chrome.runtime.lastError.message);
                window.postMessage({
                    type: 'closer-capture-response',
                    jobNumber,
                    error: chrome.runtime.lastError.message
                }, '*');
                return;
            }

            const payload = result[captureKey] || null;
            window.postMessage({
                type: 'closer-capture-response',
                jobNumber,
                payload,
                receivedAt: new Date().toISOString()
            }, '*');
        });
    });
}

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
