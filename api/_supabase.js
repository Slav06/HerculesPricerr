// Minimal Supabase REST helper for Vercel serverless functions (no supabase-js dependency)

// Hard-wire Supabase to the same project used by the frontend (dashboard / lead-profile).
// This avoids mismatches where serverless functions talk to a different database.
function getSupabaseEnv() {
    const url = 'process.env.SUPABASE_URL';
    const anonKey = 'process.env.SUPABASE_ANON_KEY';
    return { url, anonKey };
}

async function supabaseGet(path) {
    const { url, anonKey } = getSupabaseEnv();
    const res = await fetch(url.replace(/\/$/, '') + path, {
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
        },
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
}

async function supabasePost(path, body, preferReturn = 'representation') {
    const { url, anonKey } = getSupabaseEnv();
    const res = await fetch(url.replace(/\/$/, '') + path, {
        method: 'POST',
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
            Prefer: `return=${preferReturn}`,
        },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
}

async function supabasePatch(path, body, preferReturn = 'representation') {
    const { url, anonKey } = getSupabaseEnv();
    const res = await fetch(url.replace(/\/$/, '') + path, {
        method: 'PATCH',
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
            Prefer: `return=${preferReturn}`,
        },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
}

module.exports = {
    getSupabaseEnv,
    supabaseGet,
    supabasePost,
    supabasePatch,
};

