
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

async function listSessionsTable() {
    console.log("Fetching sessions from 'sessions' table...");
    const { data, error } = await client
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Total sessions in table: ${data.length}`);
    data.forEach(s => {
        console.log(`- ${s.id}: ${s.name} (Created: ${s.created_at})`);
    });
}

listSessionsTable();
