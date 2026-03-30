
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const env = {};
envFile.split('\n').filter(line => line.trim()).forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
});

const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function listSessions() {
    console.log("Fetching unique session IDs...");
    const { data: sessions, error } = await client
        .from('events')
        .select('session_id')
        .order('session_id');

    if (error) {
        console.error("Error fetching session IDs:", error);
        return;
    }

    const uniqueSessions = [...new Set(sessions.map(s => s.session_id))];
    console.log(`Unique sessions found: ${uniqueSessions.length}`);
    
    for (const sessionId of uniqueSessions) {
        const { count, error: countError } = await client
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', sessionId);
        
        if (!countError) {
            console.log(`- ${sessionId}: ${count} events`);
        }
    }
}

listSessions();
