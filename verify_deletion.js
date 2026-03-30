
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyDeletion(sessionId) {
    console.log(`Verifying deletion for session ID: ${sessionId}`);

    const { data: sess, error: sessErr } = await supabase.from('sessions').select('*').eq('id', sessionId);
    const { count: eventCount, error: eventErr } = await supabase.from('events').select('*', { count: 'exact', head: true }).eq('session_id', sessionId);
    const { count: signalCount, error: signalErr } = await supabase.from('webrtc_signals').select('*', { count: 'exact', head: true }).eq('session_id', sessionId);

    console.log(`Sessions found: ${sess?.length || 0}`);
    console.log(`Events count: ${eventCount || 0}`);
    console.log(`Signals count: ${signalCount || 0}`);

    if ((sess?.length || 0) === 0 && (eventCount || 0) === 0 && (signalCount || 0) === 0) {
        console.log('SUCCESS: All records deleted.');
    } else {
        console.log('FAILURE: Some records still exist.');
    }
}

const targetSessionId = 'a8dca092';
verifyDeletion(targetSessionId);
