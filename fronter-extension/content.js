// Content script for Page Price Analyzer
// This script runs on every page and extracts pricing information

// This is the FRONTER Chrome Extension
// Status buttons for fronters
const statusButtons = [
    { id: 'submit', text: 'Submit Job', emoji: '📋', color: '#6b46c1', status: 'new_lead' },
    { id: 'quoted', text: 'Quoted', emoji: '💰', color: '#2563eb', status: 'quoted' },
    { id: 'transferred', text: 'Transferred', emoji: '🔄', color: '#6366f1', status: 'transferred' },
    { id: 'no-answer', text: 'No Answer', emoji: '📞', color: '#d97706', status: 'no_answer' },
    { id: 'voicemail', text: 'Voicemail', emoji: '📧', color: '#d97706', status: 'voicemail' },
    { id: 'dropped', text: 'Dropped', emoji: '❌', color: '#dc3545', status: 'dropped' },
    { id: 'booked-competitor', text: 'Booked to Competitor', emoji: '🚫', color: '#6c757d', status: 'booked_to_competitor' }
];

// Slack Integration Configuration
const SLACK_CONFIG = {
    webhookUrl: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK',
    channel: '#job-notifications',
    username: 'Job Bot',
    icon_emoji: ':truck:',
    enabled: true,
    notifyOnSubmission: true
};

// Slack notification function
async function sendSlackNotification(jobData) {
    if (!SLACK_CONFIG.enabled || !SLACK_CONFIG.webhookUrl || SLACK_CONFIG.webhookUrl.includes('YOUR/SLACK/WEBHOOK')) {
        console.log('🚫 Slack notifications disabled or webhook not configured');
        return false;
    }

    try {
        const message = {
            channel: SLACK_CONFIG.channel,
            username: SLACK_CONFIG.username,
            icon_emoji: SLACK_CONFIG.icon_emoji,
            text: `🚛 New Job Submitted - ${jobData.jobNumber}`,
            attachments: [{
                color: '#36a64f',
                title: '🚛 New Job Submitted',
                title_link: jobData.pageUrl || '#',
                fields: [
                    { title: 'Job Number', value: jobData.jobNumber, short: true },
                    { title: 'Customer', value: jobData.customerName || '-', short: true },
                    { title: 'From', value: jobData.from || '-', short: true },
                    { title: 'To', value: jobData.to || '-', short: true },
                    { title: 'Distance', value: jobData.distance || '-', short: true },
                    { title: 'Pickup Date', value: jobData.pickupDate || '-', short: true },
                    { title: 'Submitted By', value: jobData.submittedBy || '-', short: true },
                    { title: 'Cubes', value: jobData.cubes || '-', short: true }
                ],
                footer: 'Job Management System',
                ts: Math.floor(Date.now() / 1000)
            }]
        };

        const response = await fetch(SLACK_CONFIG.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message)
        });

        if (response.ok) {
            console.log('✅ Slack notification sent successfully');
            return true;
        } else {
            console.error('❌ Failed to send Slack notification:', response.status, response.statusText);
            return false;
        }
    } catch (error) {
        console.error('❌ Error sending Slack notification:', error);
        return false;
    }
}

class PageAnalyzer {
    constructor() {
        this.data = {
            locations: {
                from: { zip: '', city: '', state: '' },
                to: { zip: '', city: '', state: '' }
            },
            pricing: {
                initialPrice: '',
                fuelSurcharge: '',
                extraCharges: '',
                totalEstimate: ''
            },
            jobDetails: {
                jobNumber: '',
                status: '',
                pickupDate: '',
                cubes: '',
                distance: ''
            },
            movingDetails: {
                customerName: '',
                movingFrom: '',
                movingTo: '',
                cubes: '',
                pickupDate: '',
                distance: ''
            }
        };
        this.pricingData = null;
        this.loadPricingData();
    }

    // Load pricing data from Google Sheet
    async loadPricingData() {
        try {
            const sheetUrl = 'https://docs.google.com/spreadsheets/d/1PBkNMBhstlTNZBoWONX1Te-0KcHKf2AAG95JI9WYG2g/edit?gid=0#gid=0';
            const csvUrl = sheetUrl.replace('/edit?gid=0#gid=0', '/export?format=csv&gid=0');
            
            const response = await fetch(csvUrl);
            const csvText = await response.text();
            this.pricingData = this.parseCSV(csvText);
            console.log('Pricing data loaded:', this.pricingData);
        } catch (error) {
            console.log('Pricing data loading failed (this is normal due to CORS):', error.message);
            // Don't let this error block the extension functionality
            this.pricingData = null;
        }
    }

    // Parse CSV data from Google Sheet
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index];
                });
                data.push(row);
            }
        }
        
        return data;
    }

    // Calculate price based on zip codes
    calculatePrice(fromZip, toZip) {
        if (!this.pricingData) {
            console.log('Pricing data not loaded yet');
            return null;
        }

        try {
            // Find zones for from and to zip codes
            const fromZone = this.findZoneForZip(fromZip);
            const toZone = this.findZoneForZip(toZip);
            
            if (!fromZone || !toZone) {
                console.log('Could not determine zones for zip codes');
                return null;
            }

            // Calculate distance (simplified - you can use Google Maps API for accuracy)
            const distance = this.calculateDistance(fromZip, toZip);
            
            // Get pricing for the zones
            const fromZoneData = this.pricingData.find(row => row.Zone === fromZone.toString());
            const toZoneData = this.pricingData.find(row => row.Zone === toZone.toString());
            
            if (!fromZoneData || !toZoneData) {
                console.log('Zone data not found');
                return null;
            }

            // Use the higher surcharge rate for pricing
            const surchargePerMile = Math.max(
                parseFloat(fromZoneData['Surcharge Per Mile']), 
                parseFloat(toZoneData['Surcharge Per Mile'])
            );
            
            const basePrice = parseFloat(fromZoneData['Base Price']);
            const totalPrice = basePrice + (distance * surchargePerMile);
            
            console.log(`Price calculation: Base $${basePrice} + (${distance} miles × $${surchargePerMile}) = $${totalPrice}`);
            
            return {
                basePrice: basePrice,
                distance: distance,
                surchargePerMile: surchargePerMile,
                totalPrice: totalPrice,
                fromZone: fromZone,
                toZone: toZone
            };
        } catch (error) {
            console.error('Error calculating price:', error);
            return null;
        }
    }

    // Find zone for a zip code
    findZoneForZip(zip) {
        if (!this.pricingData) return null;
        
        const zipNum = parseInt(zip);
        if (isNaN(zipNum)) return null;
        
        for (const row of this.pricingData) {
            const range = row['Zip Code Range'];
            if (range && range.includes('-')) {
                const [min, max] = range.split('-').map(z => parseInt(z));
                if (zipNum >= min && zipNum <= max) {
                    return parseInt(row.Zone);
                }
            }
        }
        return null;
    }

    // Calculate distance between zip codes (simplified)
    calculateDistance(fromZip, toZip) {
        // This is a simplified calculation - you can replace with Google Maps API
        // For now, using a rough estimate based on zip code patterns
        const fromNum = parseInt(fromZip);
        const toNum = parseInt(toZip);
        
        if (isNaN(fromNum) || isNaN(toNum)) return 1000; // Default fallback
        
        // Rough distance calculation (this is simplified)
        const diff = Math.abs(fromNum - toNum);
        if (diff < 1000) return diff * 0.1; // Close zip codes
        if (diff < 5000) return diff * 0.2; // Medium distance
        if (diff < 10000) return diff * 0.3; // Long distance
        return diff * 0.4; // Very long distance
    }

    // Main analysis function
    analyzePage() {
        try {
            console.log('Starting page analysis...');
            this.extractLocationInfo();
            this.extractPricingInfo();
            this.extractJobDetails();
            this.extractMovingDetails();
            
            console.log('Final extracted data:', this.data);
            
            return {
                success: true,
                data: this.data
            };
        } catch (error) {
            console.error('Page analysis failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Extract location information (Moving From/To)
    extractLocationInfo() {
        // Look for common patterns in moving forms
        const textContent = document.body.innerText;
        
        // First try to extract from specific "Moving From" and "Moving To" sections
        this.extractMovingSections(textContent);
        
        // If we didn't get both locations, fall back to general extraction
        if (!this.data.locations.from.zip || !this.data.locations.to.zip) {
            this.extractGeneralLocationInfo(textContent);
        }
    }

    // Extract from specific "Moving From" and "Moving To" sections
    extractMovingSections(textContent) {
        console.log('Extracting from text content:', textContent.substring(0, 1000)); // Debug first 1000 chars
        
        // Split the text into sections to isolate Moving From and Moving To
        const sections = textContent.split(/(?=Moving\s+(?:From|To))/i);
        console.log('Split sections:', sections);
        
        // Find Moving From section
        const movingFromSection = sections.find(section => 
            section.toLowerCase().includes('moving from')
        );
        
        if (movingFromSection) {
            console.log('Found Moving From section:', movingFromSection);
            // Look for zip code in this section
            const zipMatch = movingFromSection.match(/(\d{5})/);
            if (zipMatch) {
                this.data.locations.from.zip = zipMatch[1];
            }
            
            // Look for state in this section
            const stateMatch = movingFromSection.match(/\b([A-Z]{2})\b/);
            if (stateMatch) {
                this.data.locations.from.state = stateMatch[1];
            }
            
            console.log('Moving From extracted:', this.data.locations.from);
        }
        
        // Find Moving To section
        const movingToSection = sections.find(section => 
            section.toLowerCase().includes('moving to')
        );
        
        if (movingToSection) {
            console.log('Found Moving To section:', movingToSection);
            // Look for zip code in this section
            const zipMatch = movingToSection.match(/(\d{5})/);
            if (zipMatch) {
                this.data.locations.to.zip = zipMatch[1];
            }
            
            // Look for state in this section
            const stateMatch = movingToSection.match(/\b([A-Z]{2})\b/);
            if (stateMatch) {
                this.data.locations.to.state = stateMatch[1];
            }
            
            console.log('Moving To extracted:', this.data.locations.to);
        }
        
        // If we still don't have states, try to extract them separately
        if (!this.data.locations.from.state || !this.data.locations.to.state) {
            this.extractStatesSeparately(textContent);
        }
    }

    // Extract states separately if the main extraction failed
    extractStatesSeparately(textContent) {
        // Look for state patterns near the zip codes
        const statePattern = /\b([A-Z]{2})\b/g;
        const states = textContent.match(statePattern);
        
        if (states && states.length >= 2) {
            // Find which states go with which zip codes
            const zipCodes = textContent.match(/\b\d{5}\b/g);
            
            if (zipCodes && zipCodes.length >= 2) {
                // Look for state near each zip code
                const fromZip = this.data.locations.from.zip;
                const toZip = this.data.locations.to.zip;
                
                if (fromZip) {
                    // Find state near the "from" zip
                    const fromSection = textContent.substring(0, textContent.indexOf(fromZip) + 100);
                    const fromStateMatch = fromSection.match(/\b([A-Z]{2})\b/);
                    if (fromStateMatch) {
                        this.data.locations.from.state = fromStateMatch[1];
                    }
                }
                
                if (toZip) {
                    // Find state near the "to" zip
                    const toSection = textContent.substring(textContent.indexOf(toZip) - 100, textContent.indexOf(toZip) + 100);
                    const toStateMatch = toSection.match(/\b([A-Z]{2})\b/);
                    if (toStateMatch) {
                        this.data.locations.to.state = toStateMatch[1];
                    }
                }
            }
        }
    }

    // Fallback general extraction method
    extractGeneralLocationInfo(textContent) {
        // Extract zip codes - look for 5-digit patterns
        const zipCodePattern = /\b\d{5}\b/g;
        const zipCodes = textContent.match(zipCodePattern);
        
        if (zipCodes && zipCodes.length >= 2) {
            this.data.locations.from.zip = zipCodes[0];
            this.data.locations.to.zip = zipCodes[1];
        }

        // Extract city and state information
        this.extractCityState(textContent);
    }

    // Extract city and state information
    extractCityState(textContent) {
        // Common state abbreviations
        const statePattern = /\b([A-Z]{2})\b/g;
        const states = textContent.match(statePattern);
        
        if (states && states.length >= 2) {
            this.data.locations.from.state = states[0];
            this.data.locations.to.state = states[1];
        }

        // Try to extract city names (this is more complex and may need refinement)
        this.extractCityNames(textContent);
    }

    // Extract city names - look for common patterns
    extractCityNames(textContent) {
        // Look for text that might be city names
        // This is a simplified approach - in practice, you might want more sophisticated parsing
        
        // Common city indicators
        const cityIndicators = ['city:', 'city', 'town:', 'town'];
        
        for (const indicator of cityIndicators) {
            const regex = new RegExp(`${indicator}\\s*([A-Za-z\\s]+)`, 'gi');
            const matches = textContent.match(regex);
            
            if (matches && matches.length >= 2) {
                // Extract city names from matches
                const cities = matches.map(match => {
                    const city = match.replace(new RegExp(indicator, 'gi'), '').trim();
                    return city.split(/\s+/)[0]; // Take first word as city
                });
                
                if (cities.length >= 2) {
                    this.data.locations.from.city = cities[0];
                    this.data.locations.to.city = cities[1];
                    break;
                }
            }
        }
    }

    // Extract pricing information
    extractPricingInfo() {
        const textContent = document.body.innerText;
        
        // Extract initial price
        const initialPriceMatch = textContent.match(/initial\s*price[:\s]*\$?([\d,]+\.?\d*)/i);
        if (initialPriceMatch) {
            this.data.pricing.initialPrice = `$${initialPriceMatch[1]}`;
        }

        // Extract fuel surcharge
        const fuelMatch = textContent.match(/fuel\s*surcharge[:\s]*\$?([\d,]+\.?\d*)/i);
        if (fuelMatch) {
            this.data.pricing.fuelSurcharge = `$${fuelMatch[1]}`;
        }

        // Extract extra charges
        const extraMatch = textContent.match(/extra\s*charges?[:\s]*\$?([\d,]+\.?\d*)/i);
        if (extraMatch) {
            this.data.pricing.extraCharges = `$${extraMatch[1]}`;
        }

        // Extract total estimate
        const totalMatch = textContent.match(/total\s*estimate[:\s]*\$?([\d,]+\.?\d*)/i);
        if (totalMatch) {
            this.data.pricing.totalEstimate = `$${totalMatch[1]}`;
        }

        // Alternative patterns for total
        if (!this.data.pricing.totalEstimate) {
            const totalAltMatch = textContent.match(/total[:\s]*\$?([\d,]+\.?\d*)/i);
            if (totalAltMatch) {
                this.data.pricing.totalEstimate = `$${totalAltMatch[1]}`;
            }
        }
    }

    // Extract job details
    extractJobDetails() {
        const textContent = document.body.innerText;
        
        // Extract job number - try multiple methods
        let jobNumber = null;
        
        // Method 1: Look for the specific HTML structure you mentioned
        const deptElement = document.querySelector('#dept');
        if (deptElement) {
            const deptLetter = deptElement.textContent.trim();
            // Look for the number that follows the dept element
            const nextText = deptElement.nextSibling;
            if (nextText && nextText.textContent) {
                const numberMatch = nextText.textContent.match(/(\d+)/);
                if (numberMatch) {
                    jobNumber = deptLetter + numberMatch[1];
                }
            }
        }
        
        // Method 2: Look for the combined format in text content
        if (!jobNumber) {
            const combinedMatch = textContent.match(/([A-Z]\d{7})/);
            if (combinedMatch) {
                jobNumber = combinedMatch[1];
            }
        }
        
        // Method 3: Look for the old format (job no:)
        if (!jobNumber) {
            const jobMatch = textContent.match(/job\s*no[:\s]*([A-Z0-9]+)/i);
            if (jobMatch) {
                jobNumber = jobMatch[1];
            }
        }
        
        // Method 4: Look for any pattern that matches A + 7 digits
        if (!jobNumber) {
            const patternMatch = textContent.match(/([A-Z]\d{7})/g);
            if (patternMatch && patternMatch.length > 0) {
                jobNumber = patternMatch[0];
            }
        }
        
        if (jobNumber) {
            this.data.jobDetails.jobNumber = jobNumber;
            console.log('Job number extracted:', jobNumber);
        } else {
            console.log('No job number found using any method');
        }

        // Extract status
        const statusMatch = textContent.match(/status[:\s]*([A-Za-z\s-]+)/i);
        if (statusMatch) {
            this.data.jobDetails.status = statusMatch[1].trim();
        }

        // Extract pick-up date from PUDTE input
        const pickupDateInput = document.querySelector('input[name="PUDTE"]');
        if (pickupDateInput) {
            this.data.jobDetails.pickupDate = pickupDateInput.value;
            console.log('Pickup date extracted from PUDTE input:', pickupDateInput.value);
        } else {
            // Fallback: try regex pattern
            const pickupMatch = textContent.match(/pick.?up[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
            if (pickupMatch) {
                this.data.jobDetails.pickupDate = pickupMatch[1];
                console.log('Pickup date extracted from text:', pickupMatch[1]);
            }
        }

        // Extract cubes from CFLBS input
        const cubesInput = document.querySelector('input[name="CFLBS"]');
        if (cubesInput) {
            this.data.jobDetails.cubes = cubesInput.value + ' Cubes';
            console.log('Cubes extracted from CFLBS input:', cubesInput.value);
        } else {
            // Fallback: try regex pattern for cubes
            const cubesMatch = textContent.match(/(\d+)\s*cubes?/i);
            if (cubesMatch) {
                this.data.jobDetails.cubes = cubesMatch[1] + ' Cubes';
                console.log('Cubes extracted from text:', cubesMatch[1]);
            }
        }

        // Extract distance from TD2 class element
        const distanceElement = document.querySelector('td.TD2');
        if (distanceElement) {
            const distanceMatch = distanceElement.textContent.match(/Distance:\s*(\d+)\s*Miles/i);
            if (distanceMatch) {
                this.data.jobDetails.distance = distanceMatch[1] + ' Miles';
                console.log('Distance extracted from TD2 element:', distanceMatch[1]);
            }
        } else {
            // Fallback: try regex pattern for distance
            const distanceMatch = textContent.match(/distance[:\s]*(\d+)\s*miles?/i);
            if (distanceMatch) {
                this.data.jobDetails.distance = distanceMatch[1] + ' Miles';
                console.log('Distance extracted from text:', distanceMatch[1]);
            }
        }
    }

    // Extract moving details (customer name, locations, cubes, dates, distance)
    extractMovingDetails() {
        const textContent = document.body.innerText;
        
        // Extract customer name - look for the specific HTML structure
        const nameRow = document.querySelector('tr td[colspan="3"] font[face="Verdana"][color="#31557B"][size="4"] b');
        if (nameRow) {
            this.data.movingDetails.customerName = nameRow.textContent.trim();
        } else {
            // Fallback: look for any font with Verdana, color #31557B, size 4, and bold text
            const nameFallback = document.querySelector('font[face="Verdana"][color="#31557B"][size="4"] b');
            if (nameFallback) {
                this.data.movingDetails.customerName = nameFallback.textContent.trim();
            } else {
                // Additional fallback: look for any bold text in a table row
                const boldText = document.querySelector('tr td b');
                if (boldText && boldText.textContent.trim().match(/^[A-Za-z\s]+$/)) {
                    this.data.movingDetails.customerName = boldText.textContent.trim();
                }
            }
        }
        
        // Extract Moving From - look for FROMTO class table cells
        const fromToRows = document.querySelectorAll('td.FROMTO');
        console.log('Found FROMTO cells:', fromToRows.length, Array.from(fromToRows).map(el => el.textContent?.trim()));
        
        if (fromToRows.length >= 6) { // Should have 6 cells: 3 for FROM + 3 for TO
            // First 3 cells are Moving From (city, state, zip)
            const fromCity = fromToRows[0]?.textContent?.trim().replace(/\s+$/, '') || '';
            const fromState = fromToRows[1]?.textContent?.trim().replace(/\s+$/, '') || '';
            const fromZip = fromToRows[2]?.textContent?.trim().replace(/\s+$/, '') || '';
            
            if (fromCity && fromState) {
                this.data.movingDetails.movingFrom = `${fromCity}, ${fromState}`;
                if (fromZip) {
                    this.data.movingDetails.movingFrom += ` ${fromZip}`;
                }
            }
            console.log('Moving From extracted:', { fromCity, fromState, fromZip });
            
            // Next 3 cells are Moving To (city, state, zip)
            const toCity = fromToRows[3]?.textContent?.trim().replace(/\s+$/, '') || '';
            const toState = fromToRows[4]?.textContent?.trim().replace(/\s+$/, '') || '';
            const toZip = fromToRows[5]?.textContent?.trim().replace(/\s+$/, '') || '';
            
            if (toCity && toState) {
                this.data.movingDetails.movingTo = `${toCity}, ${toState}`;
                if (toZip) {
                    this.data.movingDetails.movingTo += ` ${toZip}`;
                }
            }
            console.log('Moving To extracted:', { toCity, toState, toZip });
        } else {
            // Fallback: try regex patterns if DOM structure doesn't match
            console.log('FROMTO cells not found, trying regex fallback...');
            const fromMatch = textContent.match(/Moving\s+From[:\s-]+([A-Za-z\s]+)/i);
            if (fromMatch) {
                this.data.movingDetails.movingFrom = fromMatch[1].trim();
            }
            
            const toMatch = textContent.match(/Moving\s+To[:\s-]+([A-Za-z0-9\s]+)/i);
            if (toMatch) {
                this.data.movingDetails.movingTo = toMatch[1].trim();
            }
        }
        
        // Extract Cubes from CFLBS input field
        const cubesInput = document.querySelector('input[name="CFLBS"]');
        if (cubesInput && cubesInput.value) {
            this.data.movingDetails.cubes = cubesInput.value;
            console.log('Cubes extracted from CFLBS input:', cubesInput.value);
        } else {
            // Fallback: try regex pattern
            const cubesMatch = textContent.match(/Cubes[:\s-]+(\d+)/i);
            if (cubesMatch) {
                this.data.movingDetails.cubes = cubesMatch[1];
            }
        }
        
        // Extract Pick Up Date from PUDTE input field
        const pickupInput = document.querySelector('input[name="PUDTE"]');
        if (pickupInput && pickupInput.value) {
            this.data.movingDetails.pickupDate = pickupInput.value;
            console.log('Pickup date extracted from PUDTE input:', pickupInput.value);
        } else {
            // Fallback: try regex pattern
            const pickupMatch = textContent.match(/Pick\s+Up\s+Date[:\s-]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
            if (pickupMatch) {
                this.data.movingDetails.pickupDate = pickupMatch[1];
            }
        }
        
        // Extract Distance - look for "Distance: 439 Miles" pattern
        const distanceMatch = textContent.match(/Distance[:\s]*(\d+)\s*Miles/i);
        if (distanceMatch) {
            this.data.movingDetails.distance = `${distanceMatch[1]} Miles`;
        }
        
        console.log('Moving details extracted:', this.data.movingDetails);
    }

    // Enhanced analysis for moving company specific pages
    analyzeMovingCompanyPage() {
        // Look for specific moving company patterns
        const textContent = document.body.innerText;
        
        // Check if this looks like a moving company page
        const movingKeywords = ['moving', 'charges', 'estimate', 'relocation', 'transport'];
        const isMovingPage = movingKeywords.some(keyword => 
            textContent.toLowerCase().includes(keyword)
        );

        if (isMovingPage) {
            // The enhanced extraction is now handled in extractMovingSections
            // which is called from extractLocationInfo
        }
    }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    if (request.action === 'analyzePage') {
        console.log('Starting page analysis...');
        const analyzer = new PageAnalyzer();
        
        // First try general analysis
        let result = analyzer.analyzePage();
        console.log('Initial analysis result:', result);
        
        // If it's a moving company page, do enhanced analysis
        if (result.success) {
            analyzer.analyzeMovingCompanyPage();
            // Update the result with enhanced data
            result.data = analyzer.data;
            console.log('Enhanced analysis result:', result);
        }
        
        console.log('Final result being sent:', result);
        console.log('Result data structure:', JSON.stringify(result, null, 2));
        sendResponse(result);
    }
    
    if (request.action === 'calculatePrice') {
        console.log('Calculating price for:', request.fromZip, 'to', request.toZip);
        
        try {
            const analyzer = new PageAnalyzer();
            const priceData = analyzer.calculatePrice(request.fromZip, request.toZip);
            
            if (priceData) {
                sendResponse({ 
                    success: true, 
                    priceData: priceData 
                });
            } else {
                sendResponse({ 
                    success: false, 
                    error: 'Could not calculate price' 
                });
            }
        } catch (error) {
            console.error('Error calculating price:', error);
            sendResponse({ 
                success: false, 
                error: error.message 
            });
        }
    }
    
    if (request.action === 'showTransferOverlay') {
        console.log('Content script received showTransferOverlay message:', request.data);
        console.log('Current page URL:', window.location.href);
        console.log('Target page URL:', request.data.page_url);
        showTransferOverlay(request.data);
        sendResponse({ success: true });
    }
    
    if (request.action === 'setProfileInfo') {
        console.log('Content script received profile info:', request.data);
        // Store profile info in localStorage for transfer update polling
        localStorage.setItem('chrome_profile_info', JSON.stringify(request.data));
        sendResponse({ success: true });
    }
    
    if (request.action === 'insertMaxBinder') {
        console.log('Inserting Max Binder data:', request.data);
        
        try {
            console.log('Searching for Extra fields...');
            
            // Method 1: Look for text nodes containing "Extra:"
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            let extraLabels = [];
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.trim() === 'Extra:') {
                    extraLabels.push(node.parentElement);
                }
            }
            
            console.log('Found Extra labels:', extraLabels);
            
            if (extraLabels.length > 0) {
                const firstExtraLabel = extraLabels[0];
                console.log('Processing first Extra label:', firstExtraLabel);
                console.log('Extra label HTML:', firstExtraLabel.outerHTML);
                
                // Look for the EXTRA1 input field directly in the same container as the Extra: label
                let targetInput = firstExtraLabel.querySelector('input[name="EXTRA1"]');
                
                // If not found in the same container, look in the parent
                if (!targetInput && firstExtraLabel.parentElement) {
                    targetInput = firstExtraLabel.parentElement.querySelector('input[name="EXTRA1"]');
                }
                
                // If still not found, look in the grandparent
                if (!targetInput && firstExtraLabel.parentElement && firstExtraLabel.parentElement.parentElement) {
                    targetInput = firstExtraLabel.parentElement.parentElement.querySelector('input[name="EXTRA1"]');
                }
                
                console.log('Target input found:', targetInput);
                
                if (targetInput) {
                    console.log('Targeting input field:', targetInput);
                    console.log('Input type:', targetInput.type);
                    console.log('Input name:', targetInput.name);
                    console.log('Input current value:', targetInput.value);
                    
                    // Insert the text
                    targetInput.value = request.data.extraText;
                    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('Inserted text into input field:', request.data.extraText);
                    
                    // Find and update the EXTRA1AMT amount field specifically
                    const amountField = document.querySelector('input[name="EXTRA1AMT"]');
                    
                    if (amountField) {
                        console.log('Found EXTRA1AMT amount field:', amountField);
                        console.log('Amount field current value:', amountField.value);
                        
                        // Update the amount field value
                        amountField.value = request.data.extraAmount;
                        amountField.dispatchEvent(new Event('input', { bubbles: true }));
                        amountField.dispatchEvent(new Event('change', { bubbles: true }));
                        console.log('Updated amount field to:', request.data.extraAmount);
                    } else {
                        console.log('EXTRA1AMT amount field not found');
                        
                        // Fallback: look for any input field with "0.00" value
                        const fallbackAmountFields = Array.from(document.querySelectorAll('input[type="text"]')).filter(el => 
                            el.value && /0\.00|0\.0|0/.test(el.value.trim())
                        );
                        
                        if (fallbackAmountFields.length > 0) {
                            const fallbackField = fallbackAmountFields[0];
                            console.log('Found fallback amount field:', fallbackField);
                            fallbackField.value = request.data.extraAmount;
                            fallbackField.dispatchEvent(new Event('input', { bubbles: true }));
                            fallbackField.dispatchEvent(new Event('change', { bubbles: true }));
                            console.log('Updated fallback amount field to:', request.data.extraAmount);
                        }
                    }
                    
                    // Find and click the Submit Charges button - target the specific button
                    const submitButton = document.querySelector('input[name="SUBMIT_2"][class="SUBMIT"]');
                    
                    if (submitButton) {
                        console.log('Found Submit Charges button, clicking it...');
                        console.log('Submit button details:', submitButton.outerHTML);
                        submitButton.click();
                        console.log('Submit Charges button clicked');
                    } else {
                        console.log('Submit Charges button not found, trying fallback...');
                        
                        // Fallback: look for any button with "Submit Charges" text
                        const fallbackSubmitButton = Array.from(document.querySelectorAll('*')).find(el => 
                            el.textContent && el.textContent.toLowerCase().includes('submit charges') && 
                            (el.tagName === 'BUTTON' || el.tagName === 'INPUT')
                        );
                        
                        if (fallbackSubmitButton) {
                            console.log('Found fallback Submit Charges button, clicking it...');
                            fallbackSubmitButton.click();
                            console.log('Fallback Submit Charges button clicked');
                        } else {
                            console.log('No Submit Charges button found at all');
                        }
                    }
                    
                    sendResponse({ success: true, message: 'Max Binder data inserted and submitted' });
                } else {
                    console.log('EXTRA1 input field not found near Extra label');
                    sendResponse({ success: false, error: 'EXTRA1 input field not found near Extra label' });
                }
            } else {
                console.log('No Extra labels found');
                sendResponse({ success: false, error: 'No Extra fields found on page' });
            }
            
        } catch (error) {
            console.error('Error inserting Max Binder data:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    if (request.action === 'getJobNumber') {
        console.log('Getting job number from page...');
        
        try {
            const analyzer = new PageAnalyzer();
            
            // Debug: Check what was extracted
            console.log('Analyzer data:', analyzer.data);
            console.log('Job details:', analyzer.data.jobDetails);
            
            const jobNumber = analyzer.data.jobDetails.jobNumber;
            
            if (jobNumber) {
                console.log('Job number found:', jobNumber);
                sendResponse({ 
                    success: true, 
                    jobNumber: jobNumber 
                });
            } else {
                console.log('No job number found on page');
                
                // Additional debugging for the specific element you mentioned
                const deptElement = document.querySelector('#dept');
                if (deptElement) {
                    console.log('Found #dept element:', deptElement.outerHTML);
                    console.log('Dept text:', deptElement.textContent);
                    
                    // Try to manually extract the job number
                    const deptLetter = deptElement.textContent.trim();
                    const nextText = deptElement.nextSibling;
                    if (nextText && nextText.textContent) {
                        console.log('Next sibling text:', nextText.textContent);
                        const numberMatch = nextText.textContent.match(/(\d+)/);
                        if (numberMatch) {
                            const extractedJobNumber = deptLetter + numberMatch[1];
                            console.log('Manually extracted job number:', extractedJobNumber);
                            sendResponse({ 
                                success: true, 
                                jobNumber: extractedJobNumber 
                            });
                            return;
                        }
                    }
                }
                
                sendResponse({ 
                    success: false, 
                    error: 'No job number found on page' 
                });
            }
        } catch (error) {
            console.error('Error getting job number:', error);
            sendResponse({ 
                success: false, 
                error: error.message 
            });
        }
    }
    
    // Always return true to indicate we will send a response asynchronously
    return true;
});

// Function to check if current page is a HelloMoving.com pricing page
function isHelloMovingPricingPage() {
    const currentUrl = window.location.href.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();
    
    // Check if it's a HelloMoving.com domain
    const isHelloMovingDomain = hostname.includes('hellomoving.com') || hostname.includes('ant.hellomoving.com');
    
    // Check if it's a pricing/charges page
    const isPricingPage = currentUrl.includes('mpcharge') || 
                         currentUrl.includes('charges') || 
                         currentUrl.includes('estimate') ||
                         currentUrl.includes('pricing');
    
    console.log('🔍 Page detection results:');
    console.log('- Current URL:', currentUrl);
    console.log('- Hostname:', hostname);
    console.log('- Is HelloMoving domain:', isHelloMovingDomain);
    console.log('- Is pricing page:', isPricingPage);
    console.log('- Should load overlays:', isHelloMovingDomain && isPricingPage);
    
    return isHelloMovingDomain && isPricingPage;
}

// Function to check if current page is a HelloMoving.com payment page
function isHelloMovingPaymentPage() {
    const currentUrl = window.location.href.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();
    
    // Check if it's a HelloMoving.com domain
    const isHelloMovingDomain = hostname.includes('hellomoving.com') || hostname.includes('ant.hellomoving.com');
    
    // Check if it's a payment page
    const isPaymentPage = currentUrl.includes('mpopr') && currentUrl.includes('paymentswc');
    
    console.log('🔍 Payment page detection results:');
    console.log('- Current URL:', currentUrl);
    console.log('- Hostname:', hostname);
    console.log('- Is HelloMoving domain:', isHelloMovingDomain);
    console.log('- Is payment page:', isPaymentPage);
    console.log('- Should load payment overlay:', isHelloMovingDomain && isPaymentPage);
    
    return isHelloMovingDomain && isPaymentPage;
}

// Function to create HelloMoving payment overlay directly
function createHelloMovingPaymentOverlay() {
    console.log('🔧 Creating HelloMoving payment overlay...');
    
    // Extract job data from the page
    const jobData = extractJobDataFromPage();
    const customerData = extractCustomerDataFromPage();
    
    // Create the payment overlay button
    createPaymentOverlayButton(jobData, customerData);
    
    console.log('✅ HelloMoving payment overlay created');
}

// Test encryption functionality
async function testEncryption() {
    try {
        console.log('🧪 Testing encryption system...');
        
        // Initialize encryption
        await initializeEncryption();
        
        // Test data
        const testData = {
            cardNumber: '4111111111111111',
            securityCode: '123',
            fullName: 'Test Customer'
        };
        
        console.log('📝 Original data:', testData);
        
        // Encrypt
        const encrypted = await paymentEncryption.encryptPaymentData(testData, encryptionKey);
        console.log('🔐 Encrypted data:', encrypted);
        
        // Decrypt
        const decrypted = await paymentEncryption.decryptPaymentData(encrypted, encryptionKey);
        console.log('🔓 Decrypted data:', decrypted);
        
        console.log('✅ Encryption test completed successfully!');
        return { original: testData, encrypted, decrypted };
        
    } catch (error) {
        console.error('❌ Encryption test failed:', error);
        throw error;
    }
}

// Make functions globally available for testing
window.createHelloMovingPaymentOverlay = createHelloMovingPaymentOverlay;
window.isHelloMovingPaymentPage = isHelloMovingPaymentPage;
window.testEncryption = testEncryption;
window.retrievePaymentData = retrievePaymentData;
window.processPaymentWithDecryptedData = processPaymentWithDecryptedData;

// Manual function to store captured data for testing
window.storeCapturedData = function() {
    const form = document.forms['theForm'];
    if (!form) {
        console.error('❌ HelloMoving form not found');
        return;
    }

    const jobData = extractJobDataFromPage();
    const customerData = extractCustomerDataFromPage();
    const paymentFields = extractAllPaymentFields(form, jobData, customerData);
    
    localStorage.setItem('capturedPaymentData', JSON.stringify(paymentFields));
    console.log('✅ Manual data storage complete:', paymentFields);
    
    return paymentFields;
};

// Capture payment fields and submit to dashboard
function captureAndSubmitToDashboard(jobData, customerData) {
    console.log('📋 Capturing payment fields from HelloMoving form...');
    
    // Get the current form data
    const form = document.forms['theForm'];
    if (!form) {
        console.error('❌ HelloMoving form not found');
        alert('HelloMoving payment form not found on this page');
        return;
    }

    // Extract all payment fields
    const paymentFields = extractAllPaymentFields(form, jobData, customerData);
    
    // Store the data for dashboard access
    storeCapturedPaymentForDashboard(jobData, paymentFields);
    
    console.log('✅ Payment fields captured and submitted to dashboard:', paymentFields);
    console.log('📋 Captured field details:');
    console.log('- Full Name:', paymentFields.fullName);
    console.log('- First Name:', paymentFields.firstName);
    console.log('- Last Name:', paymentFields.lastName);
    console.log('- Billing Address:', paymentFields.billingAddress);
    console.log('- City:', paymentFields.city);
    console.log('- State:', paymentFields.state);
    console.log('- Zip Code:', paymentFields.zipCode);
    console.log('- Card Number:', paymentFields.cardNumber);
    console.log('- Masked Card:', paymentFields.maskedCard);
    console.log('- Card Last Four:', paymentFields.cardLastFour);
    console.log('- Security Code:', paymentFields.securityCode);
    console.log('- Exp Month:', paymentFields.expMonth);
    console.log('- Exp Year:', paymentFields.expYear);
    console.log('- Exp Date:', paymentFields.expDate);
    
    // Show success notification
    showDashboardSubmissionNotification(paymentFields);
}

// Capture payment fields and submit to test page
function captureAndSubmitPaymentFields(jobData, customerData) {
    console.log('📋 Capturing payment fields from HelloMoving form...');
    
    // Get the current form data
    const form = document.forms['theForm'];
    if (!form) {
        console.error('❌ HelloMoving form not found');
        alert('HelloMoving payment form not found on this page');
        return;
    }

    // Extract all payment fields
    const paymentFields = extractAllPaymentFields(form, jobData, customerData);
    
    // Submit the data to the test page (like an API call)
    submitPaymentDataToTestPage(paymentFields);
    
    console.log('✅ Payment fields captured and submitted to test page:', paymentFields);
    console.log('📋 Captured field details:');
    console.log('- Full Name:', paymentFields.fullName);
    console.log('- First Name:', paymentFields.firstName);
    console.log('- Last Name:', paymentFields.lastName);
    console.log('- Billing Address:', paymentFields.billingAddress);
    console.log('- City:', paymentFields.city);
    console.log('- State:', paymentFields.state);
    console.log('- Zip Code:', paymentFields.zipCode);
    console.log('- Card Number:', paymentFields.cardNumber);
    console.log('- Masked Card:', paymentFields.maskedCard);
    console.log('- Card Last Four:', paymentFields.cardLastFour);
    console.log('- Security Code:', paymentFields.securityCode);
    console.log('- Exp Month:', paymentFields.expMonth);
    console.log('- Exp Year:', paymentFields.expYear);
    console.log('- Exp Date:', paymentFields.expDate);
    
    // Show success notification
    showCaptureNotification(paymentFields);
}

// Submit payment data to test page
async function submitPaymentDataToTestPage(paymentFields) {
    try {
        console.log('📤 Submitting payment data to test page...');
        console.log('📋 Payment data to send:', paymentFields);
        
        // First, try to send directly to any open test page windows
        try {
            const message = {
                type: 'PAYMENT_DATA_SUBMISSION',
                data: paymentFields,
                timestamp: new Date().toISOString(),
                source: 'HelloMoving Payment Page'
            };
            
            // Try to send to all windows (including test page)
            window.postMessage(message, '*');
            console.log('📨 Payment data sent via window.postMessage');
            
            // Also try sending to parent if in iframe
            if (window.parent !== window) {
                window.parent.postMessage(message, '*');
                console.log('📨 Payment data sent to parent window');
            }
            
        } catch (error) {
            console.log('⚠️ Direct postMessage failed, trying iframe method:', error);
        }
        
        // Also store in localStorage as backup
        localStorage.setItem('capturedPaymentData', JSON.stringify(paymentFields));
        console.log('📝 Data stored in localStorage as backup');
        console.log('📋 localStorage data:', JSON.parse(localStorage.getItem('capturedPaymentData')));
        
        // Create a hidden iframe to communicate with the test page
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = chrome.runtime.getURL('payment-fields-test.html');
        
        // Add iframe to page
        document.body.appendChild(iframe);
        
        // Wait for iframe to load
        iframe.onload = function() {
            try {
                // Send data to test page via postMessage
                const message = {
                    type: 'PAYMENT_DATA_SUBMISSION',
                    data: paymentFields,
                    timestamp: new Date().toISOString(),
                    source: 'HelloMoving Payment Page'
                };
                
                iframe.contentWindow.postMessage(message, '*');
                console.log('📨 Payment data sent to test page via iframe postMessage');
                
                // Remove iframe after sending
                setTimeout(() => {
                    if (iframe.parentNode) {
                        iframe.parentNode.removeChild(iframe);
                    }
                }, 1000);
                
            } catch (error) {
                console.error('❌ Error sending data to test page:', error);
                // Fallback: store in localStorage
                localStorage.setItem('capturedPaymentData', JSON.stringify(paymentFields));
                console.log('📝 Fallback: Data stored in localStorage');
            }
        };
        
        // Fallback timeout
        setTimeout(() => {
            if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }
        }, 5000);
        
    } catch (error) {
        console.error('❌ Error submitting to test page:', error);
        
        // Fallback: store in localStorage and show message
        localStorage.setItem('capturedPaymentData', JSON.stringify(paymentFields));
        
        // Show fallback notification
        showFallbackNotification(paymentFields);
    }
}

// Show fallback notification when direct submission fails
function showFallbackNotification(paymentFields) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ffc107 0%, #ff8c00 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(255, 193, 7, 0.3);
        z-index: 100000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-weight: 600;
        font-size: 14px;
        max-width: 300px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        animation: slideInRight 0.5s ease-out;
    `;

    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 18px;">⚠️</span>
            <div>
                <div style="font-weight: 600;">Data Captured & Stored</div>
                <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">
                    Job: ${paymentFields.jobNumber} | Customer: ${paymentFields.fullName || 'Unknown'}
                </div>
                <div style="font-size: 12px; opacity: 0.9;">
                    Open test page to view captured data
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Extract all payment fields from HelloMoving form
function extractAllPaymentFields(form, jobData, customerData) {
    // Extract full name and split it
    const fullName = form.CCNAME?.value || '';
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Extract state from dropdown
    const stateSelect = form.CCSTATEID;
    const stateValue = stateSelect?.options[stateSelect.selectedIndex]?.value || '';
    const stateText = stateSelect?.options[stateSelect.selectedIndex]?.text || '';

    // Extract expiration date
    const expMonth = form.EXPMONTH?.value || '';
    const expYear = form.EXPYEAR?.value || '';
    const expDate = expMonth && expYear ? `${expMonth.padStart(2, '0')}/${expYear.slice(-2)}` : '';

    // Extract card number
    const cardNumber = form.CREDITNO?.value || '';

    // Extract card type
    const cardTypeSelect = form.CREDITCO;
    const cardType = cardTypeSelect?.options[cardTypeSelect.selectedIndex]?.text || '';

    // Extract payment method
    const paymentMethodSelect = form.CTYPE;
    const paymentMethod = paymentMethodSelect?.options[paymentMethodSelect.selectedIndex]?.text || '';

    // Extract payment amount
    const paymentAmount = form.PAYAMT?.value || '0.00';

    // Extract confirmation number
    const confirmationNumber = form.REF?.value || '';

    // Extract notes
    const notes = form.NOTES?.value || '';

    const capturedData = {
        // Job Information
        jobNumber: jobData.jobNumber,
        customerName: jobData.customerName,
        jobId: jobData.jobId,
        url: window.location.href,
        capturedAt: new Date().toISOString(),
        
        // Personal Information
        fullName: fullName,
        firstName: firstName,
        lastName: lastName,
        
        // Address Information
        billingAddress: form.CCADD?.value || '',
        city: form.CCCITY?.value || '',
        state: stateText,
        stateValue: stateValue,
        zipCode: form.CCZIP?.value || '',
        country: 'USA', // Always USA
        
        // Card Information
        cardNumber: cardNumber,
        maskedCard: cardNumber ? `****${cardNumber.slice(-4)}` : '',
        cardLastFour: cardNumber.slice(-4),
        cardType: cardType,
        securityCode: form.CCCODE?.value || '',
        expMonth: expMonth,
        expYear: expYear,
        expDate: expDate,
        
        // Contact Information
        phone: form.CCPHONE?.value || '',
        email: form.CCEMAIL?.value || '',
        
        // Payment Information
        paymentMethod: paymentMethod,
        paymentAmount: parseFloat(paymentAmount) || 0,
        confirmationNumber: confirmationNumber,
        notes: notes,
        
        // Form Field Names (for reference)
        fieldNames: {
            fullName: 'CCNAME',
            billingAddress: 'CCADD',
            city: 'CCCITY',
            state: 'CCSTATEID',
            zipCode: 'CCZIP',
            cardNumber: 'CREDITNO',
            securityCode: 'CCCODE',
            expMonth: 'EXPMONTH',
            expYear: 'EXPYEAR',
            cardType: 'CREDITCO',
            paymentMethod: 'CTYPE',
            paymentAmount: 'PAYAMT',
            confirmationNumber: 'REF',
            notes: 'NOTES',
            phone: 'CCPHONE',
            email: 'CCEMAIL'
        }
    };

    return capturedData;
}

// Show capture notification
function showCaptureNotification(paymentFields) {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(40, 167, 69, 0.3);
        z-index: 100000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-weight: 600;
        font-size: 14px;
        max-width: 300px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        animation: slideInRight 0.5s ease-out;
    `;

    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 18px;">✅</span>
            <div>
                <div style="font-weight: 600;">Payment Fields Captured!</div>
                <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">
                    Job: ${paymentFields.jobNumber} | Customer: ${paymentFields.fullName || 'Unknown'}
                </div>
                <div style="font-size: 12px; opacity: 0.9;">
                    Data sent to test page
                </div>
            </div>
        </div>
    `;

    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.5s ease-out reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 500);
    }, 5000);
}

// Show dashboard submission notification
function showDashboardSubmissionNotification(paymentFields) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(40, 167, 69, 0.3);
        z-index: 100000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-weight: 600;
        font-size: 14px;
        max-width: 300px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        animation: slideInRight 0.5s ease-out;
    `;

    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 18px;">✅</span>
            <div>
                <div style="font-weight: 600;">Payment Data Sent to Production!</div>
                <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">
                    Job: ${paymentFields.jobNumber} | Customer: ${paymentFields.fullName || 'Unknown'}
                </div>
                <div style="font-size: 12px; opacity: 0.9;">
                    Data sent to Supabase database
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Extract job information from the HelloMoving page
function extractJobDataFromPage() {
    const jobMatch = document.body.innerHTML.match(/Job No: <font color="#993366">([^<]+)<\/font>/);
    const customerMatch = document.body.innerHTML.match(/Customer: <font color="#993366">([^<]+)<\/font>/);
    
    return {
        jobNumber: jobMatch ? jobMatch[1] : 'Unknown',
        customerName: customerMatch ? customerMatch[1] : 'Unknown',
        jobId: window.location.href.match(/~([A-F0-9-]+)$/)?.[1] || 'Unknown'
    };
}

// Extract customer information from existing HelloMoving form
function extractCustomerDataFromPage() {
    const form = document.forms['theForm'];
    if (!form) return {};

    // Extract full name and split it
    const fullName = form.CCNAME?.value || '';
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Extract state from dropdown
    const stateSelect = form.CCSTATEID;
    const stateValue = stateSelect?.options[stateSelect.selectedIndex]?.value || '';
    const stateText = stateSelect?.options[stateSelect.selectedIndex]?.text || '';

    // Extract expiration date
    const expMonth = form.EXPMONTH?.value || '';
    const expYear = form.EXPYEAR?.value || '';
    const expDate = expMonth && expYear ? `${expMonth.padStart(2, '0')}/${expYear.slice(-2)}` : '';

    // Extract card number
    const cardNumber = form.CREDITNO?.value || '';

    return {
        // Personal Information
        fullName: fullName,
        firstName: firstName,
        lastName: lastName,
        cardholderName: fullName, // For backward compatibility
        
        // Address Information
        billingAddress: form.CCADD?.value || '',
        city: form.CCCITY?.value || '',
        state: stateText,
        stateValue: stateValue,
        zip: form.CCZIP?.value || '',
        zipCode: form.CCZIP?.value || '', // Alternative name
        country: 'USA', // Always USA
        
        // Card Information
        cardNumber: cardNumber,
        maskedCard: cardNumber ? `****${cardNumber.slice(-4)}` : '',
        cardLastFour: cardNumber.slice(-4),
        securityCode: form.CCCODE?.value || '',
        expMonth: expMonth,
        expYear: expYear,
        expDate: expDate,
        
        // Contact Information
        phone: form.CCPHONE?.value || '',
        email: form.CCEMAIL?.value || '',
        
        // Timestamps
        extractedAt: new Date().toISOString()
    };
}

// Create the payment overlay button
function createPaymentOverlayButton(jobData, customerData) {
    // Remove existing button if any
    const existing = document.getElementById('elavon-payment-button');
    if (existing) existing.remove();

    // Create button
    const button = document.createElement('div');
    button.id = 'elavon-payment-button';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #6b46c1 0%, #553c9a 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(107, 70, 193, 0.3);
        cursor: pointer;
        z-index: 99999;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-weight: 600;
        font-size: 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s ease;
        border: 2px solid rgba(255, 255, 255, 0.2);
    `;

    button.innerHTML = `
        <span style="font-size: 20px;">💳</span>
        <span>Add Payment Info</span>
    `;

    // Add hover effects
    button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-3px)';
        button.style.boxShadow = '0 12px 40px rgba(107, 70, 193, 0.4)';
    });

    button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 8px 32px rgba(107, 70, 193, 0.3)';
    });

    // Add click handler
    button.addEventListener('click', () => {
        // Capture all payment fields from HelloMoving form and submit to dashboard
        captureAndSubmitToDashboard(jobData, customerData);
    });

    document.body.appendChild(button);
    console.log('💳 Payment overlay button created');
}

// Create the payment modal
function createPaymentModal(jobData, customerData) {
    // Remove existing modal if any
    const existing = document.getElementById('elavon-payment-modal');
    if (existing) existing.remove();

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'elavon-payment-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    modal.innerHTML = `
        <div style="background: white; border-radius: 12px; width: 600px; max-width: 90vw; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
            <div style="background: linear-gradient(135deg, #6b46c1 0%, #553c9a 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 24px; font-weight: 600;">💳 Elavon Payment Processing</h2>
                    <button id="close-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 24px; cursor: pointer; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">×</button>
                </div>
                <div style="margin-top: 10px; opacity: 0.9;">
                    <strong>Job:</strong> ${jobData.jobNumber} | <strong>Customer:</strong> ${jobData.customerName}
                </div>
            </div>
            
            <div style="padding: 30px;">
                <div style="margin-bottom: 25px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #374151;">Payment Method:</label>
                    <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="paymentMethod" value="elavon" checked style="margin-right: 8px;">
                            <span>Elavon Credit Card Processing</span>
                        </label>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="paymentMethod" value="existing" style="margin-right: 8px;">
                            <span>Use Existing HelloMoving Form</span>
                        </label>
                    </div>
                </div>
                
                <div id="elavon-form" style="display: block;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">Amount to Charge:</label>
                            <div style="position: relative;">
                                <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #6b46c1; font-weight: 600;">$</span>
                                <input type="number" id="paymentAmount" placeholder="0.00" min="0.01" step="0.01" style="width: 100%; padding: 12px 12px 12px 32px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; font-weight: 600; box-sizing: border-box;">
                            </div>
                        </div>
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">Transaction Type:</label>
                            <select id="transactionType" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                                <option value="ccsale">Sale (Authorize & Capture)</option>
                                <option value="ccauthonly">Authorization Only</option>
                            </select>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">Card Number:</label>
                        <input type="text" id="cardNumber" placeholder="1234 5678 9012 3456" maxlength="19" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">Expiration Date:</label>
                            <input type="text" id="expDate" placeholder="MM/YY" maxlength="5" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                        </div>
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">CVV:</label>
                            <input type="text" id="cvv" placeholder="123" maxlength="4" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                        </div>
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">Card Type:</label>
                            <div id="cardTypeIndicator" style="padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; text-align: center; font-size: 16px; background: #f9fafb;">💳 Unknown</div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">Cardholder First Name:</label>
                            <input type="text" id="cardFirstName" placeholder="John" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                        </div>
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">Cardholder Last Name:</label>
                            <input type="text" id="cardLastName" placeholder="Doe" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                        </div>
                    </div>
                    
                    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <span style="font-weight: 600; color: #374151;">📋 Pre-fill from existing form:</span>
                            <button type="button" id="prefillData" style="background: #6b46c1; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px;">Fill Data</button>
                        </div>
                        <div style="font-size: 14px; color: #6b7280;">
                            Customer: ${customerData.cardholderName || 'Not found'} | 
                            Address: ${customerData.billingAddress || 'Not found'} | 
                            City: ${customerData.city || 'Not found'}
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                        <button id="processElavonPayment" style="flex: 1; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; padding: 15px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            💳 Process Elavon Payment
                        </button>
                        <button id="testPayment" style="background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white; border: none; padding: 15px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            🧪 Test Payment
                        </button>
                    </div>
                    
                    <div id="paymentStatus" style="display: none; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <div id="statusContent"></div>
                    </div>
                    
                    <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                        <div style="font-weight: 600; color: #e8891f; margin-bottom: 8px;">🔄 HelloMoving Integration</div>
                        <div style="font-size: 14px; color: #e8891f;">
                            After successful Elavon processing, this will automatically update the HelloMoving payment form with the transaction details.
                        </div>
                    </div>
                </div>
                
                <div id="existing-form" style="display: none;">
                    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border: 2px solid #f59e0b;">
                        <h3 style="margin: 0 0 15px 0; color: #92400e;">📋 HelloMoving Payment Form</h3>
                        <p style="margin: 0 0 15px 0; color: #92400e;">Use the existing HelloMoving payment form on the right side of the page.</p>
                        <button id="updateExistingForm" style="background: #f59e0b; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            Update HelloMoving Form with Elavon Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add event listeners
    addModalEventListeners(modal, jobData, customerData);

    document.body.appendChild(modal);
    console.log('💳 Payment modal created');
}

// Add event listeners to the modal
function addModalEventListeners(modal, jobData, customerData) {
    // Close button
    modal.querySelector('#close-modal').addEventListener('click', () => {
        modal.remove();
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Payment method radio buttons
    const paymentMethods = modal.querySelectorAll('input[name="paymentMethod"]');
    paymentMethods.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const elavonForm = modal.querySelector('#elavon-form');
            const existingForm = modal.querySelector('#existing-form');
            
            if (e.target.value === 'elavon') {
                elavonForm.style.display = 'block';
                existingForm.style.display = 'none';
            } else {
                elavonForm.style.display = 'none';
                existingForm.style.display = 'block';
            }
        });
    });

    // Card number formatting
    const cardNumberInput = modal.querySelector('#cardNumber');
    cardNumberInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
        value = value.substring(0, 19);
        e.target.value = value;
        updateCardTypeIndicator(value.replace(/\s/g, ''));
    });

    // Expiration date formatting
    const expDateInput = modal.querySelector('#expDate');
    expDateInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        value = value.substring(0, 5);
        e.target.value = value;
    });

    // CVV input
    const cvvInput = modal.querySelector('#cvv');
    cvvInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
    });

    // Pre-fill data button
    modal.querySelector('#prefillData').addEventListener('click', () => {
        prefillFormData(modal, customerData);
    });

    // Process Elavon payment
    modal.querySelector('#processElavonPayment').addEventListener('click', () => {
        processElavonPayment(modal, jobData);
    });

    // Test payment
    modal.querySelector('#testPayment').addEventListener('click', () => {
        fillTestData(modal);
        processElavonPayment(modal, jobData);
    });

    // Update existing form
    modal.querySelector('#updateExistingForm').addEventListener('click', () => {
        showStatus(modal, 'success', 'HelloMoving form integration feature - would sync Elavon data to existing form fields.');
    });
}

// Update card type indicator
function updateCardTypeIndicator(cardNumber) {
    const indicator = document.querySelector('#cardTypeIndicator');
    if (!indicator) return;
    
    const cardType = detectCardType(cardNumber);
    const cardIcons = {
        visa: '💳 Visa',
        mastercard: '💳 Mastercard',
        amex: '💳 Amex',
        discover: '💳 Discover',
        unknown: '💳 Unknown'
    };
    
    indicator.textContent = cardIcons[cardType] || '💳 Unknown';
    indicator.style.background = cardNumber.length >= 13 ? '#e0f2fe' : '#f9fafb';
}

// Detect card type
function detectCardType(cardNumber) {
    const cleaned = cardNumber.replace(/\D/g, '');
    
    if (/^4/.test(cleaned)) return 'visa';
    if (/^5[1-5]/.test(cleaned)) return 'mastercard';
    if (/^3[47]/.test(cleaned)) return 'amex';
    if (/^6(?:011|5)/.test(cleaned)) return 'discover';
    
    return 'unknown';
}

// Pre-fill form data
function prefillFormData(modal, customerData) {
    // Pre-fill name fields (already split)
    modal.querySelector('#cardFirstName').value = customerData.firstName || '';
    modal.querySelector('#cardLastName').value = customerData.lastName || '';
    
    // Show what data was extracted
    const extractedInfo = `
        ✅ Form data pre-filled from HelloMoving form!<br>
        <strong>Extracted:</strong><br>
        • Name: ${customerData.fullName || 'Not found'}<br>
        • Address: ${customerData.billingAddress || 'Not found'}<br>
        • City: ${customerData.city || 'Not found'}<br>
        • State: ${customerData.state || 'Not found'}<br>
        • Zip: ${customerData.zipCode || 'Not found'}<br>
        • Card: ${customerData.maskedCard || 'Not found'}<br>
        • Exp: ${customerData.expDate || 'Not found'}
    `;
    
    showStatus(modal, 'success', extractedInfo);
}

// Fill test data
function fillTestData(modal) {
    modal.querySelector('#paymentAmount').value = '1.00';
    modal.querySelector('#cardNumber').value = '4000000000000002';
    modal.querySelector('#expDate').value = '12/25';
    modal.querySelector('#cvv').value = '123';
    modal.querySelector('#cardFirstName').value = 'Test';
    modal.querySelector('#cardLastName').value = 'User';
    
    updateCardTypeIndicator('4000000000000002');
}

// Process Elavon payment
async function processElavonPayment(modal, jobData) {
    const paymentData = getPaymentFormData(modal);
    
    if (!paymentData) {
        return;
    }

    // Show processing state
    const processBtn = modal.querySelector('#processElavonPayment');
    const originalText = processBtn.innerHTML;
    processBtn.innerHTML = '⏳ Processing...';
    processBtn.disabled = true;

    try {
        // Simulate payment processing (replace with actual Elavon integration)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Mock successful payment
        const result = {
            success: true,
            transactionId: 'TXN' + Date.now(),
            authCode: 'AUTH' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            amount: paymentData.amount
        };

        showStatus(modal, 'success', `
            ✅ Payment Successful!<br>
            Transaction ID: ${result.transactionId}<br>
            Amount: $${result.amount}<br>
            Auth Code: ${result.authCode}
        `);

        // Update HelloMoving form with successful payment data
        updateHelloMovingFormWithElavonData(result, paymentData);
        
        // Store payment data for dashboard submission
        storePaymentDataForDashboard(jobData, paymentData, result);
        
        // Add submit to dashboard button
        addSubmitToDashboardButton(modal, jobData, paymentData, result);
        
        // Don't hide modal automatically - let user submit to dashboard
        // setTimeout(() => {
        //     modal.remove();
        // }, 3000);

    } catch (error) {
        console.error('Payment processing error:', error);
        showStatus(modal, 'error', `❌ Payment Error: ${error.message}`);
    } finally {
        // Reset button
        processBtn.innerHTML = originalText;
        processBtn.disabled = false;
    }
}

// Get payment form data
function getPaymentFormData(modal) {
    const amount = parseFloat(modal.querySelector('#paymentAmount').value);
    const cardNumber = modal.querySelector('#cardNumber').value.replace(/\s/g, '');
    const expDate = modal.querySelector('#expDate').value;
    const cvv = modal.querySelector('#cvv').value;
    const firstName = modal.querySelector('#cardFirstName').value.trim();
    const lastName = modal.querySelector('#cardLastName').value.trim();
    const transactionType = modal.querySelector('#transactionType').value;

    // Validation
    if (!amount || amount <= 0) {
        showStatus(modal, 'error', 'Please enter a valid amount');
        return null;
    }

    if (!cardNumber || cardNumber.length < 13) {
        showStatus(modal, 'error', 'Please enter a valid card number');
        return null;
    }

    if (!expDate || !/^\d{2}\/\d{2}$/.test(expDate)) {
        showStatus(modal, 'error', 'Please enter a valid expiration date (MM/YY)');
        return null;
    }

    if (!cvv || cvv.length < 3) {
        showStatus(modal, 'error', 'Please enter a valid CVV');
        return null;
    }

    if (!firstName || firstName.length < 2) {
        showStatus(modal, 'error', 'Please enter a valid first name');
        return null;
    }

    if (!lastName || lastName.length < 2) {
        showStatus(modal, 'error', 'Please enter a valid last name');
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

// Show status message
function showStatus(modal, type, message) {
    const statusDiv = modal.querySelector('#paymentStatus');
    const statusContent = modal.querySelector('#statusContent');
    
    statusDiv.style.display = 'block';
    
    const colors = {
        success: { bg: '#d4edda', border: '#28a745', color: '#155724' },
        error: { bg: '#f8d7da', border: '#dc3545', color: '#721c24' },
        processing: { bg: '#fff3cd', border: '#ffc107', color: '#856404' }
    };
    
    const color = colors[type] || colors.error;
    statusDiv.style.background = color.bg;
    statusDiv.style.borderColor = color.border;
    statusDiv.style.color = color.color;
    statusDiv.style.border = '2px solid';
    statusDiv.style.borderRadius = '8px';
    
    statusContent.innerHTML = message;
}

// Update HelloMoving form with Elavon payment data
function updateHelloMovingFormWithElavonData(elavonResult, paymentData) {
    const form = document.forms['theForm'];
    if (!form) return;

    try {
        // Update payment amount
        if (form.PAYAMT) {
            form.PAYAMT.value = paymentData.amount.toFixed(2);
        }

        // Update confirmation number with Elavon transaction ID
        if (form.REF) {
            form.REF.value = elavonResult.transactionId || elavonResult.authCode || '';
        }

        // Update payment method to Credit Card
        if (form.CTYPE) {
            form.CTYPE.value = 'CC';
        }

        // Update cardholder information
        if (form.CCNAME) {
            form.CCNAME.value = `${paymentData.firstName} ${paymentData.lastName}`;
        }

        // Update card type
        if (form.CREDITCO) {
            const cardType = detectCardType(paymentData.cardNumber);
            const cardTypeMap = {
                visa: 'Visa',
                mastercard: 'Master Card',
                amex: 'AMEX',
                discover: 'Discover'
            };
            form.CREDITCO.value = cardTypeMap[cardType] || '';
        }

        // Update card number (masked for security)
        if (form.CREDITNO) {
            const maskedNumber = paymentData.cardNumber.replace(/\d(?=\d{4})/g, '*');
            form.CREDITNO.value = maskedNumber;
        }

        // Update expiration date
        if (form.EXPMONTH && form.EXPYEAR) {
            const [month, year] = paymentData.expDate.split('/');
            form.EXPMONTH.value = month;
            form.EXPYEAR.value = `20${year}`;
        }

        // Update notes with Elavon processing info
        if (form.NOTES) {
            const existingNotes = form.NOTES.value || '';
            const elavonNotes = `Elavon Processed - TxnID: ${elavonResult.transactionId}, Auth: ${elavonResult.authCode}`;
            form.NOTES.value = existingNotes ? `${existingNotes}; ${elavonNotes}` : elavonNotes;
        }

        console.log('✅ HelloMoving form updated with Elavon payment data');

    } catch (error) {
        console.error('Error updating HelloMoving form:', error);
    }
}

// Load encryption service
let paymentEncryption = null;
let encryptionKey = null;

// Initialize encryption
async function initializeEncryption() {
    try {
        // Load the encryption service
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('payment-encryption.js');
        document.head.appendChild(script);
        
        await new Promise((resolve) => {
            script.onload = resolve;
        });
        
        paymentEncryption = window.paymentEncryption;
        
        // Generate or load encryption key
        // In production, you should store this key securely
        const storedKey = localStorage.getItem('payment_encryption_key');
        if (storedKey) {
            encryptionKey = await paymentEncryption.importKey(storedKey);
        } else {
            // Generate new key and store it
            const keyString = await paymentEncryption.generateAppKey();
            localStorage.setItem('payment_encryption_key', keyString);
            encryptionKey = await paymentEncryption.importKey(keyString);
        }
        
        console.log('🔐 Encryption initialized successfully');
        
    } catch (error) {
        console.error('❌ Failed to initialize encryption:', error);
        throw error;
    }
}

// Send payment data to Supabase production database
async function sendPaymentDataToSupabase(paymentData) {
    try {
        // Get Supabase credentials from your existing configuration
        const supabaseUrl = 'process.env.SUPABASE_URL';
        const supabaseKey = 'process.env.SUPABASE_ANON_KEY';
        
        console.log('📤 Sending payment data to Supabase...');
        
        const response = await fetch(`${supabaseUrl}/rest/v1/payment_captures`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(paymentData)
        });

        if (!response.ok) {
            throw new Error(`Supabase error: ${response.status} ${response.statusText}`);
        }

        console.log('✅ Payment data successfully sent to Supabase production');
        return true;
        
    } catch (error) {
        console.error('❌ Failed to send data to Supabase:', error);
        throw error;
    }
}

// Store captured payment fields for dashboard
async function storeCapturedPaymentForDashboard(jobData, paymentFields) {
    try {
        // Initialize encryption if not already done
        if (!paymentEncryption || !encryptionKey) {
            await initializeEncryption();
        }

        // Prepare payment data for encryption
        const paymentDataForEncryption = {
            job_number: jobData.jobNumber,
            customer_name: jobData.customerName,
            job_id: jobData.jobId,
            url: jobData.url || window.location.href,
            
            // Personal Information
            full_name: paymentFields.fullName,
            first_name: paymentFields.firstName,
            last_name: paymentFields.lastName,
            
            // Address Information
            billing_address: paymentFields.billingAddress,
            city: paymentFields.city,
            state: paymentFields.state,
            zip_code: paymentFields.zipCode,
            country: paymentFields.country,
            
            // Card Information (will be encrypted)
            cardNumber: paymentFields.cardNumber,
            card_last_four: paymentFields.cardLastFour,
            card_type: paymentFields.cardType,
            securityCode: paymentFields.securityCode,
            exp_month: paymentFields.expMonth,
            exp_year: paymentFields.expYear,
            exp_date: paymentFields.expDate,
            
            // Contact Information
            phone: paymentFields.phone,
            email: paymentFields.email,
            
            // Payment Information
            payment_method: paymentFields.paymentMethod,
            payment_amount: paymentFields.paymentAmount,
            confirmation_number: paymentFields.confirmationNumber,
            notes: paymentFields.notes,
            
            // Metadata
            status: 'captured',
            captured_at: paymentFields.capturedAt,
            created_at: new Date().toISOString()
        };

        // Encrypt sensitive payment data
        const encryptedPaymentData = await paymentEncryption.encryptPaymentData(paymentDataForEncryption, encryptionKey);
        
        console.log('🔐 Payment data encrypted successfully');

        // Send encrypted data to Supabase production database
        await sendPaymentDataToSupabase(encryptedPaymentData);
        
        console.log('✅ Encrypted payment data sent to production Supabase');
        
    } catch (error) {
        console.error('❌ Error encrypting/sending payment data to production:', error);
        // Fallback to localStorage if encryption or Supabase fails
        const dashboardData = {
            jobNumber: jobData.jobNumber,
            customerName: jobData.customerName,
            timestamp: new Date().toISOString(),
            payment: paymentFields
        };
        localStorage.setItem(`job_${jobData.jobNumber}_payment`, JSON.stringify(dashboardData));
        console.log('📝 Fallback: Data stored in localStorage');
    }
}

// Decrypt payment data for processing
async function decryptPaymentData(encryptedData) {
    try {
        // Initialize encryption if not already done
        if (!paymentEncryption || !encryptionKey) {
            await initializeEncryption();
        }

        // Decrypt the payment data
        const decryptedData = await paymentEncryption.decryptPaymentData(encryptedData, encryptionKey);
        
        console.log('🔓 Payment data decrypted successfully');
        return decryptedData;
        
    } catch (error) {
        console.error('❌ Error decrypting payment data:', error);
        throw error;
    }
}

// Retrieve and decrypt payment data from Supabase
async function retrievePaymentData(jobNumber) {
    try {
        const supabaseUrl = 'process.env.SUPABASE_URL';
        const supabaseKey = 'process.env.SUPABASE_ANON_KEY';
        
        // Fetch encrypted data from Supabase
        const response = await fetch(`${supabaseUrl}/rest/v1/payment_captures?job_number=eq.${jobNumber}&select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch payment data: ${response.status}`);
        }

        const data = await response.json();
        if (data.length === 0) {
            throw new Error('No payment data found for this job');
        }

        // Decrypt the payment data
        const decryptedData = await decryptPaymentData(data[0]);
        
        console.log('✅ Payment data retrieved and decrypted:', decryptedData);
        return decryptedData;
        
    } catch (error) {
        console.error('❌ Error retrieving payment data:', error);
        throw error;
    }
}

// Process payment with decrypted data (for Elavon integration)
async function processPaymentWithDecryptedData(jobNumber) {
    try {
        // Retrieve and decrypt payment data
        const paymentData = await retrievePaymentData(jobNumber);
        
        // Prepare data for Elavon processing
        const elavonData = {
            cardNumber: paymentData.cardNumber,
            securityCode: paymentData.securityCode,
            expMonth: paymentData.exp_month,
            expYear: paymentData.exp_year,
            amount: paymentData.payment_amount,
            customerName: paymentData.full_name,
            billingAddress: paymentData.billing_address,
            city: paymentData.city,
            state: paymentData.state,
            zipCode: paymentData.zip_code
        };

        console.log('💳 Processing payment with Elavon...', elavonData);
        
        // Here you would call your Elavon payment processing
        // const result = await processElavonPayment(elavonData);
        
        return elavonData;
        
    } catch (error) {
        console.error('❌ Error processing payment:', error);
        throw error;
    }
}

// Store payment data for dashboard submission
function storePaymentDataForDashboard(jobData, paymentData, elavonResult) {
    try {
        const paymentRecord = {
            jobNumber: jobData.jobNumber,
            customerName: jobData.customerName,
            jobId: jobData.jobId,
            paymentAmount: paymentData.amount,
            cardLastFour: paymentData.cardNumber.slice(-4),
            cardType: detectCardType(paymentData.cardNumber),
            cardholderName: `${paymentData.firstName} ${paymentData.lastName}`,
            transactionId: elavonResult.transactionId,
            authCode: elavonResult.authCode,
            timestamp: new Date().toISOString(),
            status: 'processed'
        };

        // Store in localStorage for dashboard access
        const existingPayments = JSON.parse(localStorage.getItem('dashboard_payments') || '[]');
        existingPayments.push(paymentRecord);
        localStorage.setItem('dashboard_payments', JSON.stringify(existingPayments));

        console.log('✅ Payment data stored for dashboard:', paymentRecord);
        return paymentRecord;

    } catch (error) {
        console.error('Error storing payment data:', error);
        return null;
    }
}

// Add submit to dashboard button
function addSubmitToDashboardButton(modal, jobData, paymentData, elavonResult) {
    // Check if button already exists
    if (modal.querySelector('#submitToDashboardBtn')) return;

    const submitButton = document.createElement('button');
    submitButton.id = 'submitToDashboardBtn';
    submitButton.innerHTML = `
        <span style="font-size: 18px;">📊</span>
        Submit Job to Dashboard with Payment
    `;
    submitButton.style.cssText = `
        width: 100%;
        background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
        color: white;
        border: none;
        padding: 15px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin-top: 15px;
        transition: all 0.3s ease;
    `;

    // Add hover effect
    submitButton.addEventListener('mouseenter', () => {
        submitButton.style.transform = 'translateY(-2px)';
        submitButton.style.boxShadow = '0 8px 20px rgba(0, 123, 255, 0.3)';
    });

    submitButton.addEventListener('mouseleave', () => {
        submitButton.style.transform = 'translateY(0)';
        submitButton.style.boxShadow = 'none';
    });

    // Add click handler
    submitButton.addEventListener('click', async () => {
        await submitJobToDashboard(jobData, paymentData, elavonResult, modal);
    });

    // Insert button after payment status
    const statusDiv = modal.querySelector('#paymentStatus');
    statusDiv.parentNode.insertBefore(submitButton, statusDiv.nextSibling);

    console.log('✅ Submit to dashboard button added');
}

// Submit job to dashboard with payment data
async function submitJobToDashboard(jobData, paymentData, elavonResult, modal) {
    const submitBtn = modal.querySelector('#submitToDashboardBtn');
    const originalText = submitBtn.innerHTML;
    
    try {
        // Show processing state
        submitBtn.innerHTML = '⏳ Submitting to Dashboard...';
        submitBtn.disabled = true;

        // Prepare job data with payment information
        const jobSubmissionData = {
            jobNumber: jobData.jobNumber,
            customerName: jobData.customerName,
            jobId: jobData.jobId,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            payment: {
                amount: paymentData.amount,
                cardLastFour: paymentData.cardNumber.slice(-4),
                cardType: detectCardType(paymentData.cardNumber),
                cardholderName: `${paymentData.firstName} ${paymentData.lastName}`,
                transactionId: elavonResult.transactionId,
                authCode: elavonResult.authCode,
                status: 'processed'
            }
        };

        // Store in localStorage for dashboard access
        const existingJobs = JSON.parse(localStorage.getItem('submitted_jobs') || '[]');
        existingJobs.push(jobSubmissionData);
        localStorage.setItem('submitted_jobs', JSON.stringify(existingJobs));

        // Also store in a format that the dashboard can easily read
        localStorage.setItem(`job_${jobData.jobNumber}_payment`, JSON.stringify(jobSubmissionData));

        // Show success message
        showStatus(modal, 'success', `
            ✅ Job Submitted to Dashboard!<br>
            Job: ${jobData.jobNumber}<br>
            Customer: ${jobData.customerName}<br>
            Payment: $${paymentData.amount} (****${paymentData.cardNumber.slice(-4)})<br>
            <br>
            <strong>Dashboard will show:</strong><br>
            💳 Credit Card Button: ****${paymentData.cardNumber.slice(-4)}<br>
            Click to process additional payments
        `);

        // Close modal after 3 seconds
        setTimeout(() => {
            modal.remove();
        }, 4000);

        console.log('✅ Job submitted to dashboard with payment data:', jobSubmissionData);
        
        // Send Slack notification for new job submission
        if (SLACK_CONFIG.notifyOnSubmission) {
            const slackJobData = {
                jobNumber: jobData.jobNumber,
                customerName: jobData.customerName,
                from: jobData.from,
                to: jobData.to,
                distance: jobData.distance,
                pickupDate: jobData.pickupDate,
                submittedBy: profileInfo.userName,
                cubes: jobData.cubes,
                pageUrl: window.location.href
            };
            sendSlackNotification(slackJobData);
        }

    } catch (error) {
        console.error('Error submitting to dashboard:', error);
        showStatus(modal, 'error', `❌ Dashboard Submission Error: ${error.message}`);
    } finally {
        // Reset button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Also analyze the page when it loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page Price Analyzer content script loaded (FRONTER VERSION)');
    console.log('Current page URL:', window.location.href);
    
    // Always run the analyzer (for data extraction)
    const analyzer = new PageAnalyzer();
    analyzer.analyzePage();
    analyzer.analyzeMovingCompanyPage();
    
    // Always create overlays on HelloMoving.com pricing pages (FRONTER EXTENSION)
    if (isHelloMovingPricingPage()) {
        console.log('✅ HelloMoving pricing page detected - creating FRONTER overlays');
        
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
    console.log('Page Price Analyzer content script - window loaded (FRONTER VERSION)');
    const analyzer = new PageAnalyzer();
    analyzer.analyzePage();
    analyzer.analyzeMovingCompanyPage();
    
    // Always create overlays on HelloMoving.com pricing pages (FRONTER EXTENSION)
    if (isHelloMovingPricingPage()) {
        console.log('✅ HelloMoving pricing page detected - ensuring FRONTER overlays exist');
        
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

// No need for storage listeners in the fronter extension - overlays always show

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
    console.log('🧪 Manual test: Creating FRONTER overlays...');
    console.log('Current URL:', window.location.href);
    console.log('Is HelloMoving pricing page:', isHelloMovingPricingPage());
    
    createSubmitButtonOverlay();
    createSecurityOverlay();
    console.log('✅ Manual FRONTER overlay creation completed');
};

// Function to create and show the multi-button status overlay
function createSubmitButtonOverlay() {
    console.log('🔧 Creating multi-button status overlay...');
    
    // Remove any existing overlays
    const existingSubmitOverlay = document.getElementById('submit-button-overlay');
    const existingInvDoneOverlay = document.getElementById('inv-done-button-overlay');
    if (existingSubmitOverlay) existingSubmitOverlay.remove();
    if (existingInvDoneOverlay) existingInvDoneOverlay.remove();
    
    // Create the main overlay container
    const statusOverlay = document.createElement('div');
    statusOverlay.id = 'submit-button-overlay';
    statusOverlay.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(0, 0, 0, 0.1);
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        font-family: Arial, sans-serif;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 160px;
    `;
    
    // Use the predefined fronter status buttons
    
    // Create buttons
    statusButtons.forEach(buttonConfig => {
        const button = document.createElement('div');
        button.style.cssText = `
            background: ${buttonConfig.color};
            color: white;
            padding: 8px 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            font-size: 13px;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
            border: 2px solid transparent;
        `;
        
        button.innerHTML = `
            <span style="font-size: 14px;">${buttonConfig.emoji}</span>
            <span>${buttonConfig.text}</span>
        `;
        
        // Add hover effects
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.05)';
            button.style.borderColor = 'rgba(255, 255, 255, 0.5)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.borderColor = 'transparent';
        });
        
        // Add click functionality
        button.addEventListener('click', async () => {
            await handleStatusUpdate(buttonConfig, button);
        });
        
        statusOverlay.appendChild(button);
    });
    
    // Add to page
    document.body.appendChild(statusOverlay);
    
    console.log('✅ Multi-button status overlay created successfully');
}

// Function to handle status updates
async function handleStatusUpdate(buttonConfig, buttonElement) {
    console.log(`🔘 ${buttonConfig.text} button clicked!`);
    
    try {
        // Check if user is logged in via popup
        const popupUser = await new Promise((resolve, reject) => {
            try {
                if (!chrome || !chrome.storage || !chrome.storage.local) {
                    reject(new Error('Extension context invalidated. Please refresh the page and try again.'));
                    return;
                }
                
                chrome.storage.local.get(['popupUser'], (result) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error('Extension context invalidated. Please refresh the page and try again.'));
                        return;
                    }
                    resolve(result.popupUser || null);
                });
            } catch (error) {
                reject(new Error('Extension context invalidated. Please refresh the page and try again.'));
            }
        });
        
        if (!popupUser) {
            throw new Error('Please login to the extension popup first');
        }
        
        console.log('👤 User logged in:', popupUser.name);
        
        // Show loading state
        const originalContent = buttonElement.innerHTML;
        buttonElement.innerHTML = `
            <span style="font-size: 14px;">⏳</span>
            <span>Processing...</span>
        `;
        buttonElement.style.cursor = 'not-allowed';
        
        // Analyze the current page
        const analyzer = new PageAnalyzer();
        analyzer.analyzePage();
        analyzer.analyzeMovingCompanyPage();
        
        // Get job details
        const jobNumber = analyzer.data.jobDetails.jobNumber;
        if (!jobNumber) {
            throw new Error('No job number found on this page');
        }
        
        console.log('🔍 Job number found:', jobNumber);
        
        // Get Chrome profile info
        const profileInfo = await getChromeProfileInfo();
        
        let submissionData;
        let method = 'POST';
        let endpoint = 'process.env.SUPABASE_URL/rest/v1/job_submissions';
        
        if (buttonConfig.id === 'submit') {
            // Check for recent submissions within the last hour
            console.log('🔍 Checking for recent submissions within 1 hour for job:', jobNumber);
            
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const checkResponse = await fetch(
                `process.env.SUPABASE_URL/rest/v1/job_submissions?job_number=eq.${jobNumber}&submitted_at=gte.${oneHourAgo}&select=id,submitted_at,user_name`, 
                {
                    headers: {
                        'apikey': 'process.env.SUPABASE_ANON_KEY',
                        'Authorization': 'Bearer process.env.SUPABASE_ANON_KEY'
                    }
                }
            );
            
            if (checkResponse.ok) {
                const recentSubmissions = await checkResponse.json();
                if (recentSubmissions.length > 0) {
                    const recentSubmission = recentSubmissions[0];
                    const submittedTime = new Date(recentSubmission.submitted_at);
                    const minutesAgo = Math.round((Date.now() - submittedTime.getTime()) / (1000 * 60));
                    
                    throw new Error(`Job ${jobNumber} was already submitted ${minutesAgo} minutes ago by ${recentSubmission.user_name || 'someone'}. Please wait at least 1 hour before resubmitting.`);
                }
            }
            
            // For Submit Job - create new submission
            submissionData = {
                job_number: jobNumber,
                page_url: window.location.href,
                source: 'Page Price Analyzer Extension',
                submitted_at: new Date().toISOString(),
                chrome_profile_id: profileInfo.profileId,
                chrome_profile_name: profileInfo.userName,
                user_identifier: profileInfo.userIdentifier,
                customer_name: analyzer.data.movingDetails.customerName || null,
                moving_from: analyzer.data.movingDetails.movingFrom || null,
                moving_to: analyzer.data.movingDetails.movingTo || null,
                cubes: analyzer.data.jobDetails.cubes || analyzer.data.movingDetails.cubes || null,
                pickup_date: analyzer.data.jobDetails.pickupDate || analyzer.data.movingDetails.pickupDate || null,
                distance: analyzer.data.jobDetails.distance || analyzer.data.movingDetails.distance || null,
                user_name: popupUser.name,
                status: buttonConfig.status,
                updated_by: popupUser.name,
                updated_by_role: popupUser.role,
                updated_at: new Date().toISOString()
            };
        } else {
            // For status updates - find and update only the most recent submission
            console.log('🔍 Finding most recent submission for job:', jobNumber);
            
            // First, get the most recent submission ID for this job number
            const findResponse = await fetch(
                `process.env.SUPABASE_URL/rest/v1/job_submissions?job_number=eq.${jobNumber}&select=id&order=submitted_at.desc&limit=1`, 
                {
                    headers: {
                        'apikey': 'process.env.SUPABASE_ANON_KEY',
                        'Authorization': 'Bearer process.env.SUPABASE_ANON_KEY'
                    }
                }
            );
            
            if (!findResponse.ok) {
                throw new Error(`Failed to find submission for job ${jobNumber}`);
            }
            
            const submissions = await findResponse.json();
            if (submissions.length === 0) {
                throw new Error(`No submission found for job ${jobNumber}`);
            }
            
            const mostRecentId = submissions[0].id;
            console.log('✅ Found most recent submission ID:', mostRecentId);
            
            // Update only the most recent submission by ID
            method = 'PATCH';
            endpoint += `?id=eq.${mostRecentId}`;
            submissionData = {
                status: buttonConfig.status,
                updated_by: popupUser.name,
                updated_by_role: popupUser.role,
                updated_at: new Date().toISOString()
            };
        }
        
        console.log('📤 Submitting data:', submissionData);
        
        // Submit to Supabase
        const response = await fetch(endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'apikey': 'process.env.SUPABASE_ANON_KEY',
                'Authorization': 'Bearer process.env.SUPABASE_ANON_KEY'
            },
            body: JSON.stringify(submissionData)
        });
        
        if (response.ok) {
            console.log(`✅ ${buttonConfig.text} successful!`);
            
            // Show success state
            buttonElement.innerHTML = `
                <span style="font-size: 14px;">✅</span>
                <span>Success!</span>
            `;
            buttonElement.style.background = '#28a745';
            
            // Show success message
            const action = buttonConfig.id === 'submit' ? 'submitted' : `status updated to ${buttonConfig.status}`;
            showSuccessMessage(`Job ${jobNumber} ${action} by ${popupUser.name} (${popupUser.role})!`);
            
            // Reset after 3 seconds
            setTimeout(() => {
                buttonElement.innerHTML = originalContent;
                buttonElement.style.background = buttonConfig.color;
                buttonElement.style.cursor = 'pointer';
            }, 3000);
        } else {
            const errorText = await response.text();
            throw new Error(`${buttonConfig.text} failed: ${response.status} - ${errorText}`);
        }
        
    } catch (error) {
        console.error(`❌ Error with ${buttonConfig.text}:`, error);
        
        // Show error state
        buttonElement.innerHTML = `
            <span style="font-size: 14px;">❌</span>
            <span>Error</span>
        `;
        buttonElement.style.background = '#dc3545';
        
        // Show error message
        showErrorMessage(`${buttonConfig.text} failed: ${error.message}`);
        
        // Reset after 5 seconds
        setTimeout(() => {
            buttonElement.innerHTML = originalContent;
            buttonElement.style.background = buttonConfig.color;
            buttonElement.style.cursor = 'pointer';
        }, 5000);
    }
}



// Function to create and show the security monitoring overlay
function createSecurityOverlay() {
    // Remove any existing security overlay
    const existingSecurityOverlay = document.getElementById('security-overlay');
    if (existingSecurityOverlay) {
        existingSecurityOverlay.remove();
    }
    
    // Create the security overlay
    const securityOverlay = document.createElement('div');
    securityOverlay.id = 'security-overlay';
    securityOverlay.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 30px;
        background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(220, 53, 69, 0.4);
        z-index: 10002;
        font-family: Arial, sans-serif;
        max-width: 280px;
        border: 2px solid rgba(255,255,255,0.3);
        animation: slideInRight 0.5s ease-out;
        font-size: 12px;
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.02); }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
    
    // Create security content
    securityOverlay.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <h3 style="margin: 0; font-size: 14px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">🚨 SECURITY</h3>
            <button id="close-security-overlay" style="background: none; border: none; color: white; font-size: 16px; cursor: pointer; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.3s;">×</button>
        </div>
        <div style="background: rgba(255,255,255,0.15); padding: 8px; border-radius: 6px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.2);">
            <div style="margin-bottom: 6px; font-weight: 600; color: #fff; font-size: 11px;">⚠️ WARNING:</div>
            <div style="margin-bottom: 6px; font-size: 11px; line-height: 1.3;">
                <strong>Lead theft = ESPIONAGE</strong><br>Up to <strong>3 years in prison</strong>
            </div>
            <div style="font-size: 10px; opacity: 0.9; color: #fff; font-style: italic;">
                All activities monitored & logged
            </div>
        </div>
        <div style="text-align: center; font-size: 10px; opacity: 0.8; color: #fff;">
            🔒 Advanced security monitoring
        </div>
    `;
    
    // Add close button functionality
    const closeBtn = securityOverlay.querySelector('#close-security-overlay');
    
    // Add hover effects
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = 'rgba(255,255,255,0.2)';
        closeBtn.style.transform = 'scale(1.1)';
    });
    
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'none';
        closeBtn.style.transform = 'scale(1)';
    });
    
    closeBtn.addEventListener('click', () => {
        securityOverlay.style.animation = 'slideInRight 0.5s ease-out reverse';
        setTimeout(() => securityOverlay.remove(), 500);
    });
    
    // Add to page
    document.body.appendChild(securityOverlay);
    
    // Add pulsing animation to make it more noticeable
    securityOverlay.style.animation = 'slideInLeft 0.5s ease-out, pulse 2s ease-in-out infinite';
    
    console.log('Security overlay created');
}

// Test function to manually trigger transfer overlay (for debugging)
function testTransferOverlay() {
    console.log('Testing transfer overlay...');
    const testData = {
        jobId: 'test123',
        user_name: 'Test User',
        job_number: 'TEST001',
        chrome_profile_id: 'test_profile'
    };
    showTransferOverlay(testData);
}

// Make test functions globally available for debugging
window.testTransferOverlay = testTransferOverlay;
window.testSecurityOverlay = createSecurityOverlay;

// Add a test function for manual transfer overlay testing
window.testTransferOverlayManual = function() {
    const testData = {
        job_number: 'TEST123',
        user_name: 'Test User',
        initiated_by: 'Dashboard User',
        page_url: window.location.href
    };
    showTransferOverlay(testData);
    console.log('Manual transfer overlay test triggered');
};

// Also make the functions available immediately when script loads
if (typeof window !== 'undefined') {
    window.testTransferOverlay = testTransferOverlay;
    window.testSecurityOverlay = createSecurityOverlay;
}

console.log('Transfer overlay system initialized');

// Function to show success message
function showSuccessMessage(message) {
    const successMsg = document.createElement('div');
    successMsg.style.cssText = `
        position: fixed;
        top: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(40, 167, 69, 0.4);
        z-index: 10001;
        font-family: Arial, sans-serif;
        font-weight: 600;
        font-size: 16px;
        text-align: center;
        animation: slideInDown 0.5s ease-out;
        border: 2px solid rgba(255,255,255,0.3);
    `;
    
    successMsg.textContent = message;
    
    // Add CSS animation if not already added
    if (!document.querySelector('#message-animations')) {
        const style = document.createElement('style');
        style.id = 'message-animations';
        style.textContent = `
            @keyframes slideInDown {
                from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
                to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(successMsg);
    
    // Remove after 5 seconds
    setTimeout(() => {
        successMsg.style.animation = 'slideInDown 0.5s ease-out reverse';
        setTimeout(() => successMsg.remove(), 500);
    }, 5000);
}

function showErrorMessage(message) {
    const errorMsg = document.createElement('div');
    errorMsg.style.cssText = `
        position: fixed;
        top: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(220, 53, 69, 0.4);
        z-index: 10001;
        font-family: Arial, sans-serif;
        font-weight: 600;
        font-size: 16px;
        text-align: center;
        animation: slideInDown 0.5s ease-out;
        border: 2px solid rgba(255,255,255,0.3);
    `;
    
    errorMsg.textContent = message;
    
    // Add CSS animation if not already added
    if (!document.querySelector('#message-animations')) {
        const style = document.createElement('style');
        style.id = 'message-animations';
        style.textContent = `
            @keyframes slideInDown {
                from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
                to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(errorMsg);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorMsg.parentNode) {
            errorMsg.remove();
        }
    }, 5000);
}

// Function to get Chrome profile info
async function getChromeProfileInfo() {
    try {
        // Try to get from chrome.storage.local
        if (window.chrome && window.chrome.storage && window.chrome.storage.local) {
            const result = await new Promise((resolve) => {
                chrome.storage.local.get(['profileInfo'], (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Extension context invalidated, using fallback profile');
                        resolve(null);
                        return;
                    }
                    resolve(result.profileInfo);
                });
            });
            
            if (result) {
                return result;
            }
        }
        
        // Fallback: generate unique identifiers
        return {
            profileId: 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            profileName: 'Chrome Profile',
            userIdentifier: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        };
        
    } catch (error) {
        console.error('Error getting profile info:', error);
        return {
            profileId: 'profile_fallback',
            profileName: 'Chrome Profile',
            userIdentifier: 'user_fallback'
        };
    }
}

// Function to show transfer overlay on the page
function showTransferOverlay(transferData) {
    console.log('showTransferOverlay called with data:', transferData);
    console.log('Current time:', new Date().toISOString());
    
    // Remove any existing overlay
    const existingOverlay = document.getElementById('transfer-overlay');
    if (existingOverlay) {
        console.log('Removing existing overlay');
        existingOverlay.remove();
    }
    
    // Create the overlay
    const overlay = document.createElement('div');
    overlay.id = 'transfer-overlay';
    
    // Add a data attribute to mark this as a protected overlay
    overlay.setAttribute('data-protected', 'true');
    overlay.setAttribute('data-created-at', Date.now().toString());
    overlay.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: Arial, sans-serif;
        max-width: 300px;
        animation: slideInRight 0.5s ease-out;
        border: 2px solid #fff;
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    // Create overlay content
    overlay.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
            <h3 style="margin: 0; font-size: 20px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">🎯 JOB TRANSFERRED!</h3>
            <button id="close-transfer-overlay" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.3s;">×</button>
        </div>
        <div style="background: rgba(255,255,255,0.25); padding: 20px; border-radius: 12px; margin-bottom: 15px; border: 2px solid rgba(255,255,255,0.3);">
            <div style="margin-bottom: 12px; font-size: 16px;"><strong>📋 Job Number:</strong> <span style="color: #fff; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">${transferData.job_number || 'N/A'}</span></div>
            <div style="margin-bottom: 12px; font-size: 16px;"><strong>👤 TRANSFERRED TO:</strong> <span style="color: #fff; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">${transferData.user_name}</span></div>
            <div style="margin-bottom: 12px; font-size: 16px;"><strong>🚀 INITIATED BY:</strong> <span style="color: #fff; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">${transferData.initiated_by || 'Unknown User'}</span></div>
            <div style="font-size: 14px; opacity: 0.9; color: #fff;">🕐 ${new Date().toLocaleString()}</div>
        </div>
        <div style="text-align: center; font-size: 14px; opacity: 0.9; color: #fff; font-weight: 600; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">
            Job <strong>${transferData.job_number}</strong> transferred to <strong>${transferData.user_name}</strong> by <strong>${transferData.initiated_by || 'Unknown User'}</strong>
        </div>
        <div style="text-align: center; margin-top: 15px; font-size: 12px; opacity: 0.7; color: #fff;">
            ⏰ Overlay will auto-hide in 10 minutes
        </div>
    `;
    
    // Add close button functionality
    const closeBtn = overlay.querySelector('#close-transfer-overlay');
    
    // Add hover effects
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = 'rgba(255,255,255,0.2)';
        closeBtn.style.transform = 'scale(1.1)';
    });
    
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'none';
        closeBtn.style.transform = 'scale(1)';
    });
    
    closeBtn.addEventListener('click', () => {
        overlay.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => overlay.remove(), 300);
    });
    
    // Auto-remove after 10 minutes (600 seconds)
    setTimeout(() => {
        const overlayStillThere = document.getElementById('transfer-overlay');
        if (overlayStillThere && overlayStillThere.parentNode) {
            console.log('Auto-removing overlay after 10 minutes');
            overlayStillThere.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                if (overlayStillThere.parentNode) {
                    overlayStillThere.remove();
                    console.log('Overlay auto-removed');
                }
            }, 300);
        } else {
            console.log('Overlay already removed before auto-removal');
        }
    }, 600000);
    
    // Add to page
    document.body.appendChild(overlay);
    
    // Set up a mutation observer to detect if the overlay is removed
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.removedNodes.forEach((node) => {
                    if (node === overlay || (node.nodeType === Node.ELEMENT_NODE && node.id === 'transfer-overlay')) {
                        console.log('WARNING: Transfer overlay was removed by external code!');
                        console.log('Removal detected at:', new Date().toISOString());
                        console.log('Removing node:', node);
                        
                        // Try to re-add the overlay after a short delay
                        setTimeout(() => {
                            if (!document.getElementById('transfer-overlay')) {
                                console.log('Re-adding transfer overlay...');
                                document.body.appendChild(overlay.cloneNode(true));
                            }
                        }, 100);
                    }
                });
            }
        });
    });
    
    observer.observe(document.body, { childList: true });
    
    console.log('Transfer overlay displayed and added to DOM:', transferData);
    console.log('Overlay element:', overlay);
    console.log('Overlay parent:', overlay.parentNode);
    
    // Verify overlay is still there after a short delay
    setTimeout(() => {
        const stillThere = document.getElementById('transfer-overlay');
        console.log('Overlay still in DOM after 1 second:', !!stillThere);
        if (stillThere) {
            console.log('Overlay content:', stillThere.innerHTML.substring(0, 100) + '...');
        }
    }, 1000);
}

// Start polling for transfer updates from dashboard
function startTransferUpdatePolling() {
    console.log('Starting transfer update polling...');
    
    // Check for transfer updates every 2 seconds
    setInterval(() => {
        try {
            const transferUpdates = JSON.parse(localStorage.getItem('chromeExtensionTransferUpdates') || '{}');
            const currentProfileId = getCurrentChromeProfileId();
            
            // Look for updates for this profile
            console.log('🔍 Checking for transfer updates...');
            console.log('👤 Current profile ID:', currentProfileId);
            console.log('📋 Available transfer updates:', transferUpdates);
            
            Object.keys(transferUpdates).forEach(key => {
                const update = transferUpdates[key];
                console.log('🔍 Checking update:', update);
                console.log('🆔 Update profile ID:', update.chrome_profile_id);
                console.log('✅ Profile ID match:', update.chrome_profile_id === currentProfileId);
                
                // Check if this update is for the current profile
                if (update.chrome_profile_id === currentProfileId) {
                    console.log('Found transfer update for current profile:', update);
                    
                    // Check if this page contains the job number or customer name
                    const pageContent = document.body.textContent.toLowerCase();
                    const jobNumberMatch = update.job_number && pageContent.includes(update.job_number.toLowerCase());
                    const customerNameMatch = update.customer_name && pageContent.includes(update.customer_name.toLowerCase());
                    
                    if (jobNumberMatch || customerNameMatch) {
                        console.log('Job number match:', jobNumberMatch, 'Customer name match:', customerNameMatch);
                        console.log('Showing transfer overlay for job:', update.job_number);
                        
                        // Show the transfer overlay
                        showTransferOverlay(update);
                        
                        // Remove this update from localStorage to prevent showing it again
                        delete transferUpdates[key];
                        localStorage.setItem('chromeExtensionTransferUpdates', JSON.stringify(transferUpdates));
                        
                        console.log('Transfer overlay shown and update removed from storage');
                    } else {
                        console.log('Page does not contain job number or customer name from transfer update');
                        console.log('Looking for:', update.job_number, 'or', update.customer_name);
                        console.log('Page content preview:', pageContent.substring(0, 200) + '...');
                    }
                }
            });
            
        } catch (error) {
            console.log('Error checking for transfer updates:', error);
        }
    }, 2000); // Check every 2 seconds
}

// Get current Chrome profile ID
function getCurrentChromeProfileId() {
    // Try to get from localStorage (set by background script)
    try {
        const profileInfo = JSON.parse(localStorage.getItem('chrome_profile_info') || '{}');
        if (profileInfo.profileId) {
            console.log('Using profile ID from background script:', profileInfo.profileId);
            return profileInfo.profileId;
        }
    } catch (error) {
        console.log('Could not parse profile info:', error);
    }
    
    // Fallback: generate a profile ID based on current session
    const sessionKey = 'chrome_profile_session_' + window.location.hostname;
    let sessionId = localStorage.getItem(sessionKey);
    
    if (!sessionId) {
        sessionId = 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(sessionKey, sessionId);
        console.log('Generated new session-based profile ID:', sessionId);
    } else {
        console.log('Using existing session-based profile ID:', sessionId);
    }
    
    return sessionId;
}

// Start polling when content script loads
startTransferUpdatePolling();

// Add test functions to window object for debugging
function attachTestFunctions() {
    // Test function for manual transfer overlay testing
    window.testTransferOverlayManual = function() {
        const testData = {
            job_number: 'TEST123',
            user_name: 'Test User',
            initiated_by: 'Dashboard User',
            customer_name: 'Test Customer'
        };
        showTransferOverlay(testData);
        console.log('Manual transfer overlay test triggered');
    };

    // Test function to simulate transfer update from dashboard
    window.testTransferUpdateFromDashboard = function() {
        const testUpdate = {
            jobId: 'test123',
            user_name: 'Test User',
            job_number: 'TEST123',
            customer_name: 'Test Customer',
            chrome_profile_id: getCurrentChromeProfileId(),
            initiated_by: 'Dashboard User',
            page_url: window.location.href
        };
        
        // Store in localStorage as if it came from dashboard
        const transferUpdates = JSON.parse(localStorage.getItem('chromeExtensionTransferUpdates') || '{}');
        const key = `${testUpdate.jobId}_${testUpdate.chrome_profile_id}`;
        transferUpdates[key] = testUpdate;
        localStorage.setItem('chromeExtensionTransferUpdates', JSON.stringify(transferUpdates));
        
        console.log('Test transfer update stored in localStorage:', testUpdate);
        console.log('The polling system should detect this within 2 seconds');
    };

    // Test function to check current profile ID
    window.checkProfileId = function() {
        const profileId = getCurrentChromeProfileId();
        console.log('Current profile ID:', profileId);
        console.log('Profile info from localStorage:', localStorage.getItem('chrome_profile_info'));
        return profileId;
    };

    // Test function to check transfer updates
    window.checkTransferUpdates = function() {
        const transferUpdates = JSON.parse(localStorage.getItem('chromeExtensionTransferUpdates') || '{}');
        console.log('Current transfer updates:', transferUpdates);
        return transferUpdates;
    };

    console.log('Test functions attached to window object');
    console.log('Available test functions:');
    console.log('- testTransferOverlayManual() - Test overlay display');
    console.log('- testTransferUpdateFromDashboard() - Simulate dashboard update');
    console.log('- checkProfileId() - Check current profile ID');
    console.log('- checkTransferUpdates() - Check current transfer updates');
    
    // Verify functions are actually available
    console.log('Function availability check:');
    console.log('testTransferOverlayManual:', typeof window.testTransferOverlayManual);
    console.log('testTransferUpdateFromDashboard:', typeof window.testTransferUpdateFromDashboard);
    console.log('checkProfileId:', typeof window.checkProfileId);
    console.log('checkTransferUpdates:', typeof window.checkTransferUpdates);
}

// Attach test functions immediately and also after a delay as backup
attachTestFunctions();
setTimeout(attachTestFunctions, 1000);
