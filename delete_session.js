
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

async function deleteSession(sessionId) {
    console.log(`Starting deletion for session ID: ${sessionId}`);

    // 1. Delete from webrtc_signals
    const { error: signalError } = await supabase
        .from('webrtc_signals')
        .delete()
        .eq('session_id', sessionId);
    
    if (signalError) {
        console.error('Error deleting webrtc_signals:', signalError);
    } else {
        console.log('Deleted records from webrtc_signals.');
    }

    // 2. Delete from events
    const { error: eventError } = await supabase
        .from('events')
        .delete()
        .eq('session_id', sessionId);
    
    if (eventError) {
        console.error('Error deleting events:', eventError);
    } else {
        console.log('Deleted records from events.');
    }

    // 3. Delete from sessions
    const { error: sessionError } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);
    
    if (sessionError) {
        console.error('Error deleting session:', sessionError);
    } else {
        console.log('Deleted session from sessions table.');
    }

    console.log('Deletion process completed.');
}

const targetSessionId = 'a8dca092';
deleteSession(targetSessionId);
