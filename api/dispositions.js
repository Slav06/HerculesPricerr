// Vercel serverless function — manages dispositions with Supabase + Dialerr sync

const { getSupabaseEnv, supabaseGet, supabasePost, supabasePatch } = require('./_supabase');

const DIALERR_BASE = 'https://dialerr.com/api/v1';
const DIALERR_TOKEN = 'api_413a719aba177d28f4e9a82b4fc2fb36150b6bc54f9435f3ec67a5fea5722d04';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function dialerrGet(path) {
    const r = await fetch(`${DIALERR_BASE}${path}`, {
        headers: { Authorization: `Bearer ${DIALERR_TOKEN}` },
    });
    const data = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, data };
}

async function dialerrPost(path, body) {
    const r = await fetch(`${DIALERR_BASE}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${DIALERR_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, data };
}

async function dialerrPut(path, body) {
    const r = await fetch(`${DIALERR_BASE}${path}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${DIALERR_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, data };
}

async function supabaseDelete(path) {
    const { url, anonKey } = getSupabaseEnv();
    const r = await fetch(url.replace(/\/$/, '') + path, {
        method: 'DELETE',
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
        },
    });
    const data = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, data };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function handleList() {
    // Fetch Supabase dispositions with their wait_times
    const sbRes = await supabaseGet(
        '/rest/v1/dispositions?select=*,disposition_wait_times(*)&order=sort_order.asc,name.asc'
    );
    const sbDispositions = sbRes.ok && Array.isArray(sbRes.data) ? sbRes.data : [];

    // Fetch Dialerr dispositions
    const dlRes = await dialerrGet('/dispositions');
    const dlDispositions = dlRes.ok && Array.isArray(dlRes.data) ? dlRes.data : [];

    // Build a lookup of Dialerr names (lowercase) for matching
    const dlLookup = {};
    for (const d of dlDispositions) {
        dlLookup[(d.name || '').toLowerCase()] = d;
    }

    // Merge: start with Supabase records, mark synced if matched in Dialerr
    const merged = sbDispositions.map((sb) => {
        const key = (sb.name || '').toLowerCase();
        const dlMatch = dlLookup[key];
        // Extract wait_times as flat array of minutes
        const wait_times = (sb.disposition_wait_times || [])
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        return {
            ...sb,
            wait_times,
            synced: !!dlMatch,
            dialerr_match: dlMatch || null,
        };
    });

    // Add Dialerr-only dispositions (not in Supabase)
    const sbLookup = {};
    for (const sb of sbDispositions) {
        sbLookup[(sb.name || '').toLowerCase()] = true;
    }
    for (const d of dlDispositions) {
        const key = (d.name || '').toLowerCase();
        if (!sbLookup[key]) {
            merged.push({
                id: null,
                name: d.name,
                category: d.category || null,
                color: null,
                is_final: false,
                dialerr_id: d.id,
                wait_times: [],
                synced: false,
                dialerr_only: true,
                dialerr_match: d,
            });
        }
    }

    return { dispositions: merged };
}

async function handleCreate(body) {
    const { name, category, color, is_final, wait_times } = body || {};
    if (!name) return { error: 'name is required', status: 400 };

    // 1. Insert into Supabase dispositions table
    const sbRes = await supabasePost('/rest/v1/dispositions', {
        name,
        category: category || 'system',
        color: color || null,
        is_final: is_final || false,
    });
    if (!sbRes.ok) return { error: 'Failed to create disposition in Supabase', detail: sbRes.data, status: 500 };

    const created = Array.isArray(sbRes.data) ? sbRes.data[0] : sbRes.data;

    // 2. Insert wait_times if provided
    if (Array.isArray(wait_times) && wait_times.length > 0 && created?.id) {
        const rows = wait_times.map((minutes, i) => ({
            disposition_id: created.id,
            sort_order: i + 1,
            wait_minutes: minutes,
        }));
        await supabasePost('/rest/v1/disposition_wait_times', rows);
    }

    // 3. Create in Dialerr
    const dlCategory = mapCategoryToDialerr(category);
    const dlRes = await dialerrPost('/dispositions', { name, category: dlCategory });
    let dialerr_id = null;
    if (dlRes.ok && dlRes.data) {
        dialerr_id = dlRes.data.id || null;
        // Update Supabase record with dialerr_id
        if (dialerr_id && created?.id) {
            await supabasePatch(`/rest/v1/dispositions?id=eq.${created.id}`, { dialerr_id });
        }
    }

    return {
        disposition: { ...created, dialerr_id, wait_times: wait_times || [] },
        dialerr_sync: dlRes.ok ? 'success' : 'failed',
        dialerr_error: dlRes.ok ? null : dlRes.data,
    };
}

async function handleUpdate(body) {
    const { id, name, category, color, is_final, wait_times } = body || {};
    if (!id) return { error: 'id is required', status: 400 };

    // 1. Update the disposition record in Supabase
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (color !== undefined) updates.color = color;
    if (is_final !== undefined) updates.is_final = is_final;

    const sbRes = await supabasePatch(`/rest/v1/dispositions?id=eq.${id}`, updates);
    if (!sbRes.ok) return { error: 'Failed to update disposition in Supabase', detail: sbRes.data, status: 500 };

    const updated = Array.isArray(sbRes.data) ? sbRes.data[0] : sbRes.data;

    // 2. Replace wait_times: delete old, insert new
    if (Array.isArray(wait_times)) {
        await supabaseDelete(`/rest/v1/disposition_wait_times?disposition_id=eq.${id}`);
        if (wait_times.length > 0) {
            const rows = wait_times.map((minutes, i) => ({
                disposition_id: id,
                sort_order: i + 1,
                wait_minutes: minutes,
            }));
            await supabasePost('/rest/v1/disposition_wait_times', rows);
        }
    }

    // 3. Dialerr note — no update endpoint available
    const dialerr_note = updated?.dialerr_id
        ? 'Dialerr does not support update via API — manual sync may be needed'
        : null;

    return {
        disposition: { ...updated, wait_times: wait_times || [] },
        dialerr_note,
    };
}

async function handleDelete(body) {
    const { id } = body || {};
    if (!id) return { error: 'id is required', status: 400 };

    // Fetch the record first to check for dialerr_id
    const existing = await supabaseGet(`/rest/v1/dispositions?id=eq.${id}&select=*`);
    const record = existing.ok && Array.isArray(existing.data) ? existing.data[0] : null;

    // Delete wait_times first (in case no cascade)
    await supabaseDelete(`/rest/v1/disposition_wait_times?disposition_id=eq.${id}`);

    // Delete the disposition
    const delRes = await supabaseDelete(`/rest/v1/dispositions?id=eq.${id}`);
    if (!delRes.ok) return { error: 'Failed to delete disposition from Supabase', detail: delRes.data, status: 500 };

    const dialerr_note = record?.dialerr_id
        ? 'Dialerr does not support delete via API — disposition still exists in Dialerr'
        : null;

    return { deleted: true, id, dialerr_note };
}

async function handleSync() {
    // 1. Pull all Dialerr dispositions
    const dlRes = await dialerrGet('/dispositions');
    if (!dlRes.ok) return { error: 'Failed to fetch Dialerr dispositions', detail: dlRes.data, status: 502 };

    const dlDispositions = Array.isArray(dlRes.data?.dispositions) ? dlRes.data.dispositions :
        (Array.isArray(dlRes.data) ? dlRes.data : []);

    // 2. Pull existing Supabase dispositions for matching
    const sbRes = await supabaseGet('/rest/v1/dispositions?select=*');
    const sbDispositions = sbRes.ok && Array.isArray(sbRes.data) ? sbRes.data : [];

    // Build lookup by lowercase name (strip colons for matching)
    const sbByName = {};
    for (const sb of sbDispositions) {
        sbByName[(sb.name || '').toLowerCase().replace(/:+$/, '').trim()] = sb;
    }

    // 3. Upsert each Dialerr disposition into Supabase + sync wait times
    const results = [];
    for (const dl of dlDispositions) {
        const key = (dl.name || '').toLowerCase().replace(/:+$/, '').trim();
        const existing = sbByName[key];
        let supabaseId;

        if (existing) {
            // Update: set dialerr_id and category
            await supabasePatch(`/rest/v1/dispositions?id=eq.${existing.id}`, {
                dialerr_id: dl.id,
                category: dl.category || existing.category,
            });
            supabaseId = existing.id;
            results.push({ name: dl.name, action: 'linked', supabase_id: existing.id, dialerr_id: dl.id });
        } else {
            // Insert new
            const ins = await supabasePost('/rest/v1/dispositions', {
                name: dl.name,
                category: dl.category || 'system',
                dialerr_id: dl.id,
            });
            const created = ins.ok && Array.isArray(ins.data) ? ins.data[0] : ins.data;
            supabaseId = created?.id;
            results.push({ name: dl.name, action: 'created', supabase_id: created?.id, dialerr_id: dl.id });
        }

        // Sync wait times / cadence from Dialerr
        if (supabaseId && Array.isArray(dl.wait_times) && dl.wait_times.length > 0) {
            // Delete existing wait times for this disposition
            await supabaseDelete(`/rest/v1/disposition_wait_times?disposition_id=eq.${supabaseId}`);

            // Insert Dialerr wait times (deduplicate by wait_minutes value)
            const seen = new Set();
            const uniqueWaitTimes = dl.wait_times.filter(wt => {
                if (seen.has(wt.wait_minutes)) return false;
                seen.add(wt.wait_minutes);
                return true;
            });

            const rows = uniqueWaitTimes.map((wt, i) => ({
                disposition_id: supabaseId,
                sort_order: i + 1,
                wait_minutes: wt.wait_minutes,
            }));
            if (rows.length > 0) {
                await supabasePost('/rest/v1/disposition_wait_times', rows);
            }

            const lastResult = results[results.length - 1];
            lastResult.wait_times_synced = rows.length;
            lastResult.wait_times = rows.map(r => r.wait_minutes);
        } else if (supabaseId) {
            const lastResult = results[results.length - 1];
            lastResult.wait_times_synced = 0;
            lastResult.wait_times = [];
        }
    }

    // 4. Sync job_status_tiers from Dialerr cadence — create new, update existing wait times
    const existingTiers = await supabaseGet('/rest/v1/job_status_tiers?select=status_key');
    const tierKeys = new Set((existingTiers.data || []).map(t => t.status_key));
    let tiersCreated = 0;
    let tiersUpdated = 0;

    for (const dl of dlDispositions) {
        const statusKey = (dl.name || '').toLowerCase().replace(/[:：]+/g, '').trim().replace(/\s+/g, '_');
        if (!statusKey) continue;

        const cat = dl.category === 'positive' ? 'good' : dl.category === 'negative' ? 'dead' : 'maybe';
        const isFinal = dl.category === 'negative' || dl.category === 'positive';
        const waitTimes = (dl.wait_times || []).map(wt => wt.wait_minutes).filter(Boolean);

        if (tierKeys.has(statusKey)) {
            // Update existing tier with Dialerr's cadence
            await supabasePatch(`/rest/v1/job_status_tiers?status_key=eq.${encodeURIComponent(statusKey)}`, {
                max_attempts: waitTimes.length || 0,
                wait_times_json: JSON.stringify(waitTimes),
                updated_at: new Date().toISOString(),
            });
            tiersUpdated++;
        } else {
            // Create new tier
            const priority = cat === 'good' ? 10 : cat === 'dead' ? 20 : 80;
            await supabasePost('/rest/v1/job_status_tiers', {
                status_key: statusKey,
                display_name: (dl.name || '').replace(/[:：]+$/, '').trim(),
                tier: isFinal ? 5 : 2,
                priority_score: priority,
                category: cat,
                max_attempts: waitTimes.length || 0,
                wait_times_json: JSON.stringify(waitTimes),
            });
            tierKeys.add(statusKey);
            tiersCreated++;
        }
    }

    // 5. Auto-configure webhook URL on any Dialerr disposition that doesn't have one
    const webhookUrl = 'https://pricerr.vercel.app/api/dialerr-webhook';
    let webhooksConfigured = 0;

    for (const dl of dlDispositions) {
        // Configure webhook for each disposition via Dialerr API
        try {
            const evtRes = await dialerrPut(`/dispositions/${dl.id}/events`, {
                webhook: { enabled: true, url: webhookUrl, headers: {} }
            });
            if (evtRes.ok) webhooksConfigured++;
        } catch (e) { /* skip */ }
    }

    // 6. Return merged list
    const merged = await handleList();
    return { sync_results: results, synced_count: results.length, tiersCreated, webhooksConfigured, ...merged };
}

// ---------------------------------------------------------------------------
// Category mapping
// ---------------------------------------------------------------------------

function mapCategoryToDialerr(category) {
    const map = { positive: 'positive', negative: 'negative', system: 'system' };
    return map[(category || '').toLowerCase()] || 'system';
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

module.exports = async (req, res) => {
    cors(res);

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    const action = req.query?.action;

    try {
        let result;

        switch (action) {
            case 'list':
                if (req.method !== 'GET') return res.status(405).json({ error: 'GET required for list' });
                result = await handleList();
                break;

            case 'create':
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST required for create' });
                result = await handleCreate(req.body);
                break;

            case 'update':
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST required for update' });
                result = await handleUpdate(req.body);
                break;

            case 'delete':
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST required for delete' });
                result = await handleDelete(req.body);
                break;

            case 'sync':
                // Allow GET for cron + POST for manual
                result = await handleSync();
                break;

            default:
                return res.status(400).json({ error: 'Missing or invalid action. Use: list, create, update, delete, sync' });
        }

        // If the handler returned an error status, use it
        if (result?.status && result?.error) {
            const status = result.status;
            delete result.status;
            return res.status(status).json(result);
        }

        return res.status(200).json(result);
    } catch (err) {
        console.error('dispositions error:', err);
        return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
};
