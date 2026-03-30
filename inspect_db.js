
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

async function inspect() {
    const sessionId = '350b2a59';
    const { count, error } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Total events for ${sessionId} in DB (exact): ${count}`);
}

inspect();
