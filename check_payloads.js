
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

async function checkPayloads() {
    const sessionId = '350b2a59';
    const { data: events, error } = await client
        .from('events')
        .select('*')
        .eq('session_id', sessionId)
        .order('seq', { ascending: false })
        .limit(10);
    
    if (error) return;

    events.forEach(e => {
        console.log(`- ${e.type} | Payload keys: ${Object.keys(e.payload)}`);
        if (e.type === 'TURN_ORDER_UPDATED') {
            console.log(`  characterIds: ${e.payload.characterIds}`);
        }
    });
}

checkPayloads();
