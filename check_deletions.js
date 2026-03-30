
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

async function checkDeletions() {
    const sessionId = '350b2a59';
    console.log(`Checking deletions for session ${sessionId}...`);
    
    const { data: events, error } = await client
        .from('events')
        .select('*')
        .eq('session_id', sessionId)
        .eq('type', 'CHARACTER_DELETED');

    if (error) return;

    console.log(`Found ${events.length} CHARACTER_DELETED events.`);
    events.forEach(e => {
        console.log(`- Seq: ${e.seq} | ID: ${e.id} | Payload: ${JSON.stringify(e.payload)}`);
    });

    const { data: created, error: error2 } = await client
        .from('events')
        .select('*')
        .eq('session_id', sessionId)
        .eq('type', 'CHARACTER_CREATED');
    
    console.log(`Found ${created.length} CHARACTER_CREATED events.`);
}

checkDeletions();
