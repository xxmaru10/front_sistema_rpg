
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkEspecialistas() {
    console.log('Searching for "Especialistas_2" in sessions and events...');

    // 1. Check sessions table
    const { data: sessions, error: sessError } = await supabase
        .from('sessions')
        .select('*');

    if (sessError) {
        console.error('Error fetching sessions:', sessError);
    } else {
        const foundSessions = sessions.filter(s => s.name && s.name.includes('Especialistas'));
        console.log('Found sessions matching "Especialistas":', foundSessions);
    }

    // 2. Check events for creation codes
    const { data: events, error: eventError } = await supabase
        .from('events')
        .select('session_id, type, payload')
        .in('type', ['SESSION_CREATED', 'SESSION_CODES_UPDATED']);

    if (eventError) {
        console.error('Error fetching events:', eventError);
    } else {
        console.log('Checking events for session codes...');
        // We'll match session IDs from step 1 or just look at all of them
        events.forEach(e => {
            const sessionName = e.payload?.name || '';
            if (sessionName.includes('Especialistas')) {
                console.log(`Match found in event! Session: ${sessionName} (ID: ${e.session_id})`);
                console.log(`GM Code: ${e.payload.gmCode}`);
                console.log(`Player Code: ${e.payload.playerCode}`);
            }
        });
    }
}

checkEspecialistas();
