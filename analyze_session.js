
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

async function analyzeEvents() {
    const sessionId = '350b2a59';
    console.log(`Analyzing events for session ${sessionId}...`);
    
    const { data: counts, error } = await client
        .from('events')
        .select('type')
        .eq('session_id', sessionId);

    if (error) {
        console.error("Error:", error);
        return;
    }

    const typeCounts = {};
    counts.forEach(c => {
        typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
    });

    console.log("Event Type Counts:");
    Object.entries(typeCounts).sort((a,b) => b[1] - a[1]).forEach(([type, count]) => {
        console.log(`- ${type}: ${count}`);
    });

    // Check last few events
    const { data: lastEvents, error: lastError } = await client
        .from('events')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(5);
    
    if (!lastError) {
        console.log("\nLast 5 events:");
        lastEvents.forEach(e => {
            console.log(`- ${e.created_at} [${e.type}] by ${e.actor_user_id}`);
        });
    }
}

analyzeEvents();
