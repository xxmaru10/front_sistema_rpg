
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
    
    let allTypes = [];
    let hasMore = true;
    let offset = 0;

    while (hasMore) {
        const { data, error } = await client
            .from('events')
            .select('type')
            .eq('session_id', sessionId)
            .range(offset, offset + 999);

        if (error) {
            console.error("Error:", error);
            break;
        }

        allTypes = allTypes.concat(data.map(d => d.type));
        offset += data.length;
        if (data.length < 1000) hasMore = false;
    }

    const typeCounts = {};
    allTypes.forEach(type => {
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    console.log(`Total events retrieved: ${allTypes.length}`);
    console.log("Event Type Counts:");
    Object.entries(typeCounts).sort((a,b) => b[1] - a[1]).forEach(([type, count]) => {
        console.log(`- ${type}: ${count}`);
    });
}

analyzeEvents();
