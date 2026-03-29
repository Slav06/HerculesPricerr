// GoHighLevel Webhook Handler for Analytics Auto-Sync
// This endpoint receives webhooks from GoHighLevel and automatically syncs data to Supabase

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.status(200).end();
        return;
    }

    // Allow GET for webhook verification (GoHighLevel may verify the endpoint)
    if (req.method === 'GET') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json({ 
            status: 'ok', 
            message: 'GoHighLevel webhook endpoint is active',
            timestamp: new Date().toISOString()
        });
        return;
    }

    // Only allow POST requests for webhook events
    if (req.method !== 'POST') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const webhookData = req.body;
        
        // Log full webhook payload for debugging
        console.log('📥 GoHighLevel Webhook Received:', JSON.stringify(webhookData, null, 2));
        
        const eventType = webhookData.type || webhookData.event || webhookData.eventType || 'unknown';
        console.log('🔍 Detected event type:', eventType);
        
        // Process the webhook based on event type
        let syncResult = null;
        
        // Check if this is a contact-related event (handle various formats)
        const isContactEvent = 
            eventType.includes('contact') || 
            eventType.includes('Contact') ||
            webhookData.contact ||
            webhookData.contactId ||
            (webhookData.data && (webhookData.data.email || webhookData.data.phone));
        
        // Check if this is an opportunity event
        const isOpportunityEvent = 
            eventType.includes('opportunity') || 
            eventType.includes('Opportunity') ||
            webhookData.opportunity ||
            webhookData.opportunityId;
        
        // Check if this is an appointment event
        const isAppointmentEvent = 
            eventType.includes('appointment') || 
            eventType.includes('Appointment') ||
            webhookData.appointment ||
            webhookData.appointmentId;
        
        if (isContactEvent) {
            console.log('✅ Processing as contact event');
            syncResult = await syncContactEvent(webhookData);
        } else if (isOpportunityEvent) {
            console.log('✅ Processing as opportunity event');
            syncResult = await syncOpportunityEvent(webhookData);
        } else if (isAppointmentEvent) {
            console.log('✅ Processing as appointment event');
            syncResult = await syncAppointmentEvent(webhookData);
        } else {
            // Try to detect contact data in unknown events
            const hasContactData = webhookData.email || webhookData.phone || 
                                 webhookData.data?.email || webhookData.data?.phone ||
                                 webhookData.contact?.email || webhookData.contact?.phone;
            
            if (hasContactData) {
                console.log('⚠️ Unknown event type but contains contact data - processing as contact');
                syncResult = await syncContactEvent(webhookData);
            } else {
                console.log('⚠️ Unknown event type, triggering full sync');
                syncResult = await triggerFullSync(webhookData);
            }
        }

        // Store webhook event in analytics table
        await storeWebhookEvent({
            event_type: eventType,
            webhook_data: webhookData,
            sync_result: syncResult,
            received_at: new Date().toISOString()
        });

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        
        res.status(200).json({
            success: true,
            message: 'Webhook processed successfully',
            event_type: eventType,
            sync_result: syncResult
        });

    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        
        // Store error in analytics for debugging
        try {
            await storeWebhookEvent({
                event_type: 'error',
                webhook_data: req.body,
                sync_result: { error: error.message },
                received_at: new Date().toISOString()
            });
        } catch (storeError) {
            console.error('Failed to store error event:', storeError);
        }
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
};

// Sync contact event to analytics AND create/update job submission
async function syncContactEvent(webhookData) {
    // Extract contact from various possible locations in webhook payload
    // IMPORTANT: GHL workflow webhooks send data flat at root level (full_name, email, phone)
    // while GHL API webhooks nest under contact/data. Check if root has the real data first.
    let contact;

    // If the root has full_name or first_name, the contact data IS the root payload
    if (webhookData.full_name || webhookData.first_name ||
        (webhookData.email && webhookData.phone && !webhookData.contact?.email)) {
        contact = webhookData;
    } else {
        contact = webhookData.contact ||
                  webhookData.data ||
                  webhookData.payload ||
                  webhookData;
        // If contact is nested, try to extract it
        if (webhookData.body?.contact) contact = webhookData.body.contact;
        if (webhookData.body?.data) contact = webhookData.body.data;

        // Final check: if extracted contact has no name/email but root does, use root
        const contactHasData = contact.firstName || contact.first_name || contact.email || contact.name;
        const rootHasData = webhookData.full_name || webhookData.first_name || webhookData.email;
        if (!contactHasData && rootHasData) {
            contact = webhookData;
        }
    }
    
    const eventType = webhookData.type || webhookData.event || webhookData.eventType || 'contact.updated';
    
    console.log('📋 Processing contact event:', {
        eventType,
        contactId: contact.id,
        hasEmail: !!(contact.email || contact.emails),
        hasPhone: !!(contact.phone || contact.phones),
        contactKeys: Object.keys(contact).slice(0, 10)
    });
    
    // Skip deletion events for job submissions (keep them in the system)
    if (eventType.includes('deleted') || eventType.includes('delete')) {
        console.log('⏭️ Skipping job submission creation for deleted contact');
        // Still sync to analytics but don't create/update job submission
        return await syncContactToAnalytics(contact);
    }
    
    // Create or update job submission from GHL contact
    console.log('🔄 Creating/updating job submission from contact...');
    const jobSubmissionResult = await syncContactToJobSubmission(contact, eventType);
    console.log('📊 Job submission result:', jobSubmissionResult);
    
    // Also sync to analytics
    const analyticsResult = await syncContactToAnalytics(contact);
    
    return {
        job_submission: jobSubmissionResult,
        analytics: analyticsResult
    };
}

// Sync contact to job_submissions table
async function syncContactToJobSubmission(contact, eventType) {
    console.log('🔍 syncContactToJobSubmission called with:', {
        hasContact: !!contact,
        contactId: contact?.id,
        contactKeys: contact ? Object.keys(contact).slice(0, 15) : []
    });
    
    if (!contact) {
        console.error('❌ No contact data provided');
        return { skipped: true, reason: 'No contact data' };
    }
    
    // Contact ID might be in different places
    const contactId = contact.id || contact.contactId || contact.contact_id;
    if (!contactId) {
        console.warn('⚠️ No contact ID found, but proceeding with available data');
    }
    
    try {
        // Extract contact data - handle multiple formats
        const email = contact.email || 
                     contact.emailAddress ||
                     contact.emails?.[0]?.value || 
                     contact.emails?.[0] ||
                     (Array.isArray(contact.emails) && contact.emails.length > 0 ? contact.emails[0] : null) ||
                     null;
        
        const phone = contact.phone || 
                     contact.phoneNumber ||
                     contact.phones?.[0]?.value || 
                     contact.phones?.[0] ||
                     (Array.isArray(contact.phones) && contact.phones.length > 0 ? contact.phones[0] : null) ||
                     null;
        
        const firstName = contact.firstName || contact.first_name || '';
        const lastName = contact.lastName || contact.last_name || '';
        const customerName = contact.full_name ||
                            contact.name ||
                            contact.contactName ||
                            contact.fullName ||
                            contact.customData?.name ||
                            `${firstName} ${lastName}`.trim() ||
                            'Unknown';
        
        console.log('📋 Extracted contact data:', {
            customerName,
            email: email ? email.substring(0, 20) + '...' : null,
            phone: phone ? phone.substring(0, 15) + '...' : null,
            firstName,
            lastName
        });
        
        // Skip if no identifying info
        if ((!customerName || customerName === 'Unknown' || customerName.trim() === '') && !email && !phone) {
            console.log('⏭️ Skipping contact - no name, email, or phone:', contactId);
            return { skipped: true, reason: 'No identifying info' };
        }
        
        // Extract address (moving_from) — handle flat GHL workflow format
        let movingFrom = null;
        if (contact.full_address) {
            movingFrom = contact.full_address;
        } else if (contact['From Address']) {
            movingFrom = contact['From Address'];
        } else {
            const address = contact.address || contact.addresses?.[0] || {};
            if (address.city && address.state) {
                movingFrom = `${address.city}, ${address.state}`;
            } else if (address.address1 || address.street1) {
                movingFrom = address.address1 || address.street1;
            } else if (contact.city && contact.state) {
                movingFrom = `${contact.city}, ${contact.state}`;
            } else if (contact.city) {
                movingFrom = contact.city;
            }
        }

        // Extract custom fields — check both nested customFields AND flat top-level GHL fields
        const customFields = contact.customFields || contact.custom_fields || {};
        const movingTo = contact['To Address'] || customFields.moving_to || customFields['Moving To'] || customFields.destination || null;
        const cubes = contact['Cubes'] || customFields.cubes || customFields['Cubes'] || customFields.cubic_feet || null;
        const pickupDate = contact['Pickup Date'] || contact['Move Date'] || customFields.pickup_date || customFields['Pickup Date'] || customFields.move_date || null;
        const distance = contact['Distance'] || customFields.distance || customFields['Distance'] || null;
        const clickId = contact['Click ID'] || customFields.clickid || customFields['Click ID'] || customFields.click_id || customFields.ref_id || contact.contact_source || contact.source || null;

        // Extract notes from GHL (often contains lead details)
        const ghlNotes = contact.Notes || contact.notes || customFields.Notes || null;

        // Extract status from webhook (Dialerr sends cb_scheduled, etc.)
        const webhookStatus = contact.status || contact.Status || contact.disposition ||
                              customFields.status || customFields.Status || null;

        // Extract callback/follow-up scheduling from Dialerr or GHL
        const rawCallback = contact.next_callback || contact.nextCallback || contact['Next Callback'] ||
                           contact.callback_date || contact.callbackDate || contact['Callback Date'] ||
                           contact.next_followup || contact.nextFollowup || contact['Next Followup'] ||
                           customFields.next_callback || customFields['Next Callback'] ||
                           customFields.callback_date || customFields['Callback Date'] || null;

        let callbackDate = null;
        let callbackTime = null;
        if (rawCallback) {
            try {
                const cbDate = new Date(rawCallback);
                if (!isNaN(cbDate.getTime())) {
                    // Format as YYYY-MM-DD for callback_date
                    callbackDate = cbDate.getFullYear() + '-' +
                        String(cbDate.getMonth() + 1).padStart(2, '0') + '-' +
                        String(cbDate.getDate()).padStart(2, '0');
                    // Format as HH:MM:SS for callback_time
                    callbackTime = String(cbDate.getHours()).padStart(2, '0') + ':' +
                        String(cbDate.getMinutes()).padStart(2, '0') + ':' +
                        String(cbDate.getSeconds()).padStart(2, '0');
                    console.log('📅 Parsed callback:', callbackDate, callbackTime, 'from raw:', rawCallback);
                }
            } catch (e) {
                console.warn('⚠️ Failed to parse callback date:', rawCallback, e.message);
            }
        }

        // Check if job submission already exists (by email OR phone)
        let existingJob = null;
        if (email) {
            const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/job_submissions?select=id,job_number&email=eq.${encodeURIComponent(email)}&limit=1`, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            });
            if (checkRes.ok) {
                const checkData = await checkRes.json();
                if (checkData && checkData.length > 0) {
                    existingJob = checkData[0];
                }
            }
        }
        
        // If no email match, check by phone
        if (!existingJob && phone) {
            const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/job_submissions?select=id,job_number&phone=eq.${encodeURIComponent(phone)}&limit=1`, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            });
            if (checkRes.ok) {
                const checkData = await checkRes.json();
                if (checkData && checkData.length > 0) {
                    existingJob = checkData[0];
                }
            }
        }
        
        // Generate job number if new — uses contact_source for prefix
        const contactSource = contact.contact_source || contact.source || contact['Form Source'] || contact['Lead Source'] || null;
        const jobNumber = existingJob?.job_number || await generateJobNumber(contactSource);
        
        const jobSubmissionData = {
            job_number: jobNumber,
            customer_name: customerName,
            email: email,
            phone: phone,
            moving_from: movingFrom,
            moving_to: movingTo,
            cubes: cubes ? String(cubes) : null,
            pickup_date: pickupDate,
            distance: distance ? String(distance) : null,
            click_id: clickId ? String(clickId) : null,
            ref_id: clickId ? String(clickId) : null,
            source: 'GoHighLevel Webhook',
            notes: ghlNotes || null,
            submitted_at: contact.date_created || contact.dateAdded || contact.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        // Only set status if webhook provides one, otherwise default for new jobs
        if (webhookStatus) {
            jobSubmissionData.status = webhookStatus;
        } else if (!existingJob) {
            jobSubmissionData.status = 'new_lead';
        }
        // Don't overwrite status on existing jobs when webhook has no status

        // Add callback scheduling if present
        if (callbackDate) {
            jobSubmissionData.callback_date = callbackDate;
            jobSubmissionData.callback_time = callbackTime;
            if (callbackDate && callbackTime) {
                jobSubmissionData.callback_datetime = callbackDate + 'T' + callbackTime;
            }
        }
        
        if (existingJob) {
            // Update existing job submission
            const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/job_submissions?id=eq.${existingJob.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(jobSubmissionData)
            });
            
            if (updateRes.ok) {
                const updated = await updateRes.json();
                return { updated: true, job_id: existingJob.id, job_number: jobNumber };
            } else {
                const error = await updateRes.text();
                console.error('Failed to update job submission:', error);
                return { error: 'Update failed', details: error };
            }
        } else {
            // Create new job submission
            const createRes = await fetch(`${SUPABASE_URL}/rest/v1/job_submissions`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(jobSubmissionData)
            });
            
            if (createRes.ok) {
                const created = await createRes.json();
                const newJob = Array.isArray(created) ? created[0] : created;
                console.log('✅ Created job submission from webhook:', newJob.id, jobNumber);
                return { created: true, job_id: newJob.id, job_number: jobNumber };
            } else {
                const error = await createRes.text();
                console.error('❌ Failed to create job submission:', error, 'Job data:', jobSubmissionData);
                return { error: 'Create failed', details: error };
            }
        }
    } catch (error) {
        console.error('Error syncing contact to job submission:', error);
        return { error: error.message };
    }
}

// Source abbreviation map
const SOURCE_PREFIX_MAP = {
    'angieslist': 'AL',
    'angi': 'AL',
    'caff-t1a-inhouse': 'IH',
    'caff-t1a': 'CF',
    'caff-t3a': 'C3',
    'caff': 'CF',
    'homeadvisor': 'HA',
    'google': 'G',
    'google lsa': 'GL',
    'googlelsa': 'GL',
    'facebook': 'FB',
    'yelp': 'YP',
    'thumbtack': 'TT',
    'referral': 'RF',
    'website': 'WB',
    'crm workflows': 'CW',
};

function getSourcePrefix(contactSource) {
    if (!contactSource) return 'GH'; // default for unknown GHL source
    const key = contactSource.toLowerCase().trim();
    // Exact match first
    if (SOURCE_PREFIX_MAP[key]) return SOURCE_PREFIX_MAP[key];
    // Partial match
    for (const [pattern, prefix] of Object.entries(SOURCE_PREFIX_MAP)) {
        if (key.includes(pattern)) return prefix;
    }
    // Fallback: take first 2 chars uppercase
    const clean = contactSource.replace(/[^a-zA-Z]/g, '');
    return clean.slice(0, 2).toUpperCase() || 'GH';
}

// Generate a job number: prefix + next sequential number (e.g. AL1042, CF1043)
async function generateJobNumber(contactSource) {
    const prefix = getSourcePrefix(contactSource);

    // Get the highest existing job number with this prefix
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/job_submissions?job_number=like.${prefix}*&select=job_number&order=id.desc&limit=1`,
        {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        }
    );
    let nextNum = 1001; // start from 1001
    if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
            const lastNum = parseInt(data[0].job_number.replace(prefix, ''), 10);
            if (!isNaN(lastNum)) nextNum = lastNum + 1;
        }
    }

    return `${prefix}${nextNum}`;
}

// Sync contact to analytics (original function)
async function syncContactToAnalytics(contact) {
    // Fetch current analytics snapshot
    const currentSnapshot = await getLatestAnalyticsSnapshot();
    
    // Update contact count and data
    const updatedSnapshot = {
        ...currentSnapshot,
        contacts: currentSnapshot.contacts || [],
        last_contact_update: new Date().toISOString()
    };
    
    // Add or update contact in snapshot
    if (contact.id) {
        const contactIndex = updatedSnapshot.contacts.findIndex(c => c.id === contact.id);
        if (contactIndex >= 0) {
            updatedSnapshot.contacts[contactIndex] = contact;
        } else {
            updatedSnapshot.contacts.push(contact);
        }
    }
    
    // Store updated analytics
    const analyticsRecord = {
        sync_timestamp: new Date().toISOString(),
        total_contacts: updatedSnapshot.contacts.length,
        total_opportunities: currentSnapshot.total_opportunities || 0,
        data_snapshot: updatedSnapshot,
        synced_by: 'webhook',
        sync_status: 'completed'
    };
    
    return await storeAnalyticsData(analyticsRecord);
}

// Sync opportunity event to analytics
async function syncOpportunityEvent(webhookData) {
    const opportunity = webhookData.opportunity || webhookData.data || webhookData;
    
    // Fetch current analytics snapshot
    const currentSnapshot = await getLatestAnalyticsSnapshot();
    
    // Update opportunity count and data
    const updatedSnapshot = {
        ...currentSnapshot,
        opportunities: currentSnapshot.opportunities || [],
        last_opportunity_update: new Date().toISOString()
    };
    
    // Add or update opportunity in snapshot
    if (opportunity.id) {
        const oppIndex = updatedSnapshot.opportunities.findIndex(o => o.id === opportunity.id);
        if (oppIndex >= 0) {
            updatedSnapshot.opportunities[oppIndex] = opportunity;
        } else {
            updatedSnapshot.opportunities.push(opportunity);
        }
    }
    
    // Store updated analytics
    const analyticsRecord = {
        sync_timestamp: new Date().toISOString(),
        total_contacts: currentSnapshot.total_contacts || 0,
        total_opportunities: updatedSnapshot.opportunities.length,
        data_snapshot: updatedSnapshot,
        synced_by: 'webhook',
        sync_status: 'completed'
    };
    
    return await storeAnalyticsData(analyticsRecord);
}

// Sync appointment event to analytics
async function syncAppointmentEvent(webhookData) {
    const appointment = webhookData.appointment || webhookData.data || webhookData;
    
    // Fetch current analytics snapshot
    const currentSnapshot = await getLatestAnalyticsSnapshot();
    
    // Update appointment data
    const updatedSnapshot = {
        ...currentSnapshot,
        appointments: currentSnapshot.appointments || [],
        last_appointment_update: new Date().toISOString()
    };
    
    // Add or update appointment in snapshot
    if (appointment.id) {
        const apptIndex = updatedSnapshot.appointments.findIndex(a => a.id === appointment.id);
        if (apptIndex >= 0) {
            updatedSnapshot.appointments[apptIndex] = appointment;
        } else {
            updatedSnapshot.appointments.push(appointment);
        }
    }
    
    // Store updated analytics
    const analyticsRecord = {
        sync_timestamp: new Date().toISOString(),
        total_contacts: currentSnapshot.total_contacts || 0,
        total_opportunities: currentSnapshot.total_opportunities || 0,
        data_snapshot: updatedSnapshot,
        synced_by: 'webhook',
        sync_status: 'completed'
    };
    
    return await storeAnalyticsData(analyticsRecord);
}

// Trigger a full sync when needed (for bulk updates or unknown events)
async function triggerFullSync(webhookData) {
    // This would trigger a full API sync, but for now we'll just log it
    // In production, you might want to queue this for async processing
    console.log('🔄 Full sync triggered by webhook:', webhookData);
    
    return {
        message: 'Full sync queued',
        triggered_at: new Date().toISOString()
    };
}

// Get latest analytics snapshot from Supabase
async function getLatestAnalyticsSnapshot() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/ghl_analytics?order=sync_timestamp.desc&limit=1`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                return data[0].data_snapshot || {
                    contacts: [],
                    opportunities: [],
                    appointments: []
                };
            }
        }
    } catch (error) {
        console.error('Error fetching latest snapshot:', error);
    }
    
    // Return empty snapshot if none exists
    return {
        contacts: [],
        opportunities: [],
        appointments: []
    };
}

// Store analytics data in Supabase (used by analytics sync and webhook event log).
// Returns { ok: true, result } on success, { ok: false, error } on failure (caller can decide whether to throw).
async function storeAnalyticsData(analyticsRecord) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/ghl_analytics`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(analyticsRecord)
    });
    
    if (!response.ok) {
        const error = await response.text();
        console.error('ghl_analytics POST failed:', response.status, error);
        return { ok: false, error: error || String(response.status) };
    }
    
    const result = await response.json();
    return { ok: true, result };
}

// Store webhook event for debugging and audit trail
async function storeWebhookEvent(eventData) {
    try {
        // Store in a webhook_logs table if it exists, or in analytics table with a flag
        const logRecord = {
            sync_timestamp: eventData.received_at,
            data_snapshot: {
                webhook_event: eventData.event_type,
                webhook_data: eventData.webhook_data,
                sync_result: eventData.sync_result
            },
            synced_by: 'webhook',
            sync_status: eventData.sync_result?.error ? 'error' : 'completed'
        };
        
        // Store as analytics record for now (you can create a separate table later)
        await storeAnalyticsData(logRecord);
    } catch (error) {
        console.error('Failed to store webhook event:', error);
        // Don't throw - webhook event logging is not critical
    }
}
