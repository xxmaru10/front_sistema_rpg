
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

async function checkRecentEvents() {
    const sessionId = '350b2a59';
    console.log(`Checking events for session ${sessionId}...`);
    
    const { data: events, error } = await client
        .from('events')
        .select('*')
        .eq('session_id', sessionId)
        .order('seq', { ascending: false })
        .limit(20);

    if (error) {
        console.error(error);
        return;
    }

    console.log("Last 20 events by sequence:");
    events.forEach(e => {
        console.log(`- Seq: ${e.seq} | Type: ${e.type} | Actor: ${e.actor_user_id}`);
    });
}

checkRecentEvents();
