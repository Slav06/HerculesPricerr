// Agent Portal API — Vercel serverless function
// Handles all dispatch/agent operations via ?action= query parameter

const { getSupabaseEnv, supabaseGet, supabasePost, supabasePatch } = require('./_supabase');

// DELETE helper (same pattern as supabasePatch)
async function supabaseDelete(path) {
    const { url, anonKey } = getSupabaseEnv();
    const res = await fetch(url.replace(/\/$/, '') + path, {
        method: 'DELETE',
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
        },
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
}

// Storage upload helper
async function supabaseStorageUpload(bucketPath, binaryData, contentType) {
    const { url, anonKey } = getSupabaseEnv();
    const res = await fetch(url.replace(/\/$/, '') + `/storage/v1/object/inventory-photos/${bucketPath}`, {
        method: 'POST',
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': contentType,
            'x-upsert': 'true',
        },
        body: binaryData,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
}

// Storage delete helper
async function supabaseStorageDelete(bucketPath) {
    const { url, anonKey } = getSupabaseEnv();
    const res = await fetch(url.replace(/\/$/, '') + `/storage/v1/object/inventory-photos/${bucketPath}`, {
        method: 'DELETE',
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
        },
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
}

function getPublicUrl(bucketPath) {
    const { url } = getSupabaseEnv();
    return `${url.replace(/\/$/, '')}/storage/v1/object/public/inventory-photos/${bucketPath}`;
}

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const action = req.query.action;
    if (!action) {
        return res.status(400).json({ success: false, error: 'Missing action parameter' });
    }

    try {
        switch (action) {

            // 1. List all agents
            case 'agents': {
                const result = await supabaseGet('/rest/v1/dashboard_users?role=eq.agent&select=id,name,role,isactive');
                if (!result.ok) return res.status(result.status).json({ success: false, error: result.data });
                return res.status(200).json({ success: true, data: result.data });
            }

            // 2. Create a new agent
            case 'create-agent': {
                const { name, secretkey } = req.body || {};
                if (!name || !secretkey) {
                    return res.status(400).json({ success: false, error: 'name and secretkey are required' });
                }
                const result = await supabasePost('/rest/v1/dashboard_users', {
                    name,
                    secretkey,
                    role: 'agent',
                    isactive: true,
                });
                if (!result.ok) return res.status(result.status).json({ success: false, error: result.data });
                return res.status(201).json({ success: true, data: result.data });
            }

            // 3. Get all booked jobs
            case 'booked-jobs': {
                const result = await supabaseGet(
                    '/rest/v1/job_submissions?status=eq.Booked&select=id,job_number,customer_name,email,phone,moving_from,moving_to,pickup_date,cubes,distance,status,assigned_to&order=pickup_date.asc'
                );
                if (!result.ok) return res.status(result.status).json({ success: false, error: result.data });
                return res.status(200).json({ success: true, data: result.data });
            }

            // 4. Assign a job to an agent
            case 'assign-job': {
                const { agent_user_id, agent_name, job_submission_id, job_number, assigned_by } = req.body || {};
                if (!agent_user_id || !agent_name || !job_submission_id || !job_number) {
                    return res.status(400).json({ success: false, error: 'agent_user_id, agent_name, job_submission_id, job_number are required' });
                }

                // Delete any existing assignment for this job
                await supabaseDelete(`/rest/v1/agent_job_assignments?job_number=eq.${encodeURIComponent(job_number)}`);

                // Create new assignment
                const assignResult = await supabasePost('/rest/v1/agent_job_assignments', {
                    agent_user_id,
                    agent_name,
                    job_submission_id,
                    job_number,
                    assigned_by: assigned_by || null,
                    status: 'assigned',
                    assigned_at: new Date().toISOString(),
                });
                if (!assignResult.ok) return res.status(assignResult.status).json({ success: false, error: assignResult.data });

                // Update job_submissions assigned_to
                const patchResult = await supabasePatch(
                    `/rest/v1/job_submissions?job_number=eq.${encodeURIComponent(job_number)}`,
                    { assigned_to: agent_name }
                );
                if (!patchResult.ok) return res.status(patchResult.status).json({ success: false, error: patchResult.data });

                return res.status(200).json({ success: true, data: assignResult.data });
            }

            // 5. Unassign a job
            case 'unassign-job': {
                const { job_number: unassignJobNumber } = req.body || {};
                if (!unassignJobNumber) {
                    return res.status(400).json({ success: false, error: 'job_number is required' });
                }

                // Delete assignment
                await supabaseDelete(`/rest/v1/agent_job_assignments?job_number=eq.${encodeURIComponent(unassignJobNumber)}`);

                // Clear assigned_to on job_submissions
                const clearResult = await supabasePatch(
                    `/rest/v1/job_submissions?job_number=eq.${encodeURIComponent(unassignJobNumber)}`,
                    { assigned_to: null }
                );
                if (!clearResult.ok) return res.status(clearResult.status).json({ success: false, error: clearResult.data });

                return res.status(200).json({ success: true, data: clearResult.data });
            }

            // 6. Get agent's assigned jobs
            case 'my-jobs': {
                const agentUserId = req.query.agent_user_id;
                if (!agentUserId) {
                    return res.status(400).json({ success: false, error: 'agent_user_id query param is required' });
                }

                // Get assignments for this agent
                const assignmentsResult = await supabaseGet(
                    `/rest/v1/agent_job_assignments?agent_user_id=eq.${encodeURIComponent(agentUserId)}&select=*&order=assigned_at.desc`
                );
                if (!assignmentsResult.ok) return res.status(assignmentsResult.status).json({ success: false, error: assignmentsResult.data });

                const assignments = assignmentsResult.data || [];
                if (assignments.length === 0) {
                    return res.status(200).json({ success: true, data: [] });
                }

                // Fetch job_submission data for each assignment
                const jobNumbers = assignments.map(a => a.job_number);
                const jobNumberFilter = jobNumbers.map(jn => `"${jn}"`).join(',');
                const jobsResult = await supabaseGet(
                    `/rest/v1/job_submissions?job_number=in.(${jobNumberFilter})&select=id,job_number,customer_name,email,phone,moving_from,moving_to,pickup_date,cubes,distance,status,assigned_to`
                );

                // Merge assignment data with job data
                const jobsMap = {};
                if (jobsResult.ok && jobsResult.data) {
                    jobsResult.data.forEach(j => { jobsMap[j.job_number] = j; });
                }

                const combined = assignments.map(a => ({
                    ...a,
                    job: jobsMap[a.job_number] || null,
                }));

                return res.status(200).json({ success: true, data: combined });
            }

            // 7. Update assignment status
            case 'update-status': {
                const { job_number: statusJobNumber, status: newStatus, notes } = req.body || {};
                if (!statusJobNumber || !newStatus) {
                    return res.status(400).json({ success: false, error: 'job_number and status are required' });
                }

                const validStatuses = ['assigned', 'in_progress', 'completed'];
                if (!validStatuses.includes(newStatus)) {
                    return res.status(400).json({ success: false, error: `status must be one of: ${validStatuses.join(', ')}` });
                }

                const patchBody = { status: newStatus };
                if (notes !== undefined) patchBody.notes = notes;
                if (newStatus === 'completed') patchBody.completed_at = new Date().toISOString();

                const result = await supabasePatch(
                    `/rest/v1/agent_job_assignments?job_number=eq.${encodeURIComponent(statusJobNumber)}`,
                    patchBody
                );
                if (!result.ok) return res.status(result.status).json({ success: false, error: result.data });

                return res.status(200).json({ success: true, data: result.data });
            }

            // 8. Upload photos
            case 'upload-photos': {
                const { job_number: photoJobNumber, item_name, photos, uploaded_by } = req.body || {};
                if (!photoJobNumber || !item_name || !photos || !Array.isArray(photos) || photos.length === 0) {
                    return res.status(400).json({ success: false, error: 'job_number, item_name, and photos array are required' });
                }

                const uploadedPhotos = [];
                for (const photo of photos) {
                    const { filename, base64, content_type } = photo;
                    if (!filename || !base64 || !content_type) continue;

                    const storagePath = `${photoJobNumber}/${item_name}/${filename}`;
                    const binaryData = Buffer.from(base64, 'base64');

                    const uploadResult = await supabaseStorageUpload(storagePath, binaryData, content_type);
                    if (!uploadResult.ok) {
                        uploadedPhotos.push({ filename, error: uploadResult.data });
                        continue;
                    }

                    const publicUrl = getPublicUrl(storagePath);

                    // Save record to inventory_photos table
                    const dbResult = await supabasePost('/rest/v1/inventory_photos', {
                        job_number: photoJobNumber,
                        item_name,
                        filename,
                        storage_path: storagePath,
                        public_url: publicUrl,
                        content_type,
                        uploaded_by: uploaded_by || null,
                        uploaded_at: new Date().toISOString(),
                    });

                    uploadedPhotos.push({
                        filename,
                        public_url: publicUrl,
                        storage_path: storagePath,
                        db_record: dbResult.ok ? dbResult.data : null,
                        error: dbResult.ok ? null : dbResult.data,
                    });
                }

                return res.status(200).json({ success: true, data: uploadedPhotos });
            }

            // 9. Get photos for a job
            case 'photos': {
                const photosJobNumber = req.query.job_number;
                if (!photosJobNumber) {
                    return res.status(400).json({ success: false, error: 'job_number query param is required' });
                }

                let query = `/rest/v1/inventory_photos?job_number=eq.${encodeURIComponent(photosJobNumber)}&order=uploaded_at.desc`;
                if (req.query.item_name) {
                    query += `&item_name=eq.${encodeURIComponent(req.query.item_name)}`;
                }

                const result = await supabaseGet(query);
                if (!result.ok) return res.status(result.status).json({ success: false, error: result.data });
                return res.status(200).json({ success: true, data: result.data });
            }

            // 10. Delete a photo
            case 'delete-photo': {
                const { photo_id, storage_path } = req.body || {};
                if (!photo_id || !storage_path) {
                    return res.status(400).json({ success: false, error: 'photo_id and storage_path are required' });
                }

                // Delete from DB
                await supabaseDelete(`/rest/v1/inventory_photos?id=eq.${encodeURIComponent(photo_id)}`);

                // Delete from storage
                await supabaseStorageDelete(storage_path);

                return res.status(200).json({ success: true, data: { deleted: true } });
            }

            // 11. Save/upsert inventory
            case 'save-inventory': {
                const { job_submission_id, items, total_volume } = req.body || {};
                if (!job_submission_id || !items) {
                    return res.status(400).json({ success: false, error: 'job_submission_id and items are required' });
                }

                // Check if record exists
                const existing = await supabaseGet(
                    `/rest/v1/inventory_submissions?job_submission_id=eq.${encodeURIComponent(job_submission_id)}&select=id`
                );

                const payload = {
                    job_submission_id,
                    items: JSON.stringify(items),
                    total_volume: total_volume || 0,
                    updated_at: new Date().toISOString(),
                };

                let result;
                if (existing.ok && existing.data && existing.data.length > 0) {
                    // Update existing
                    result = await supabasePatch(
                        `/rest/v1/inventory_submissions?job_submission_id=eq.${encodeURIComponent(job_submission_id)}`,
                        payload
                    );
                } else {
                    // Create new
                    payload.created_at = new Date().toISOString();
                    result = await supabasePost('/rest/v1/inventory_submissions', payload);
                }

                if (!result.ok) return res.status(result.status).json({ success: false, error: result.data });
                return res.status(200).json({ success: true, data: result.data });
            }

            // 12. Get all assignments (dispatch view)
            case 'assignments': {
                const result = await supabaseGet('/rest/v1/agent_job_assignments?select=*&order=assigned_at.desc');
                if (!result.ok) return res.status(result.status).json({ success: false, error: result.data });
                return res.status(200).json({ success: true, data: result.data });
            }

            default:
                return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
        }
    } catch (err) {
        console.error('agent-portal error:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
};
