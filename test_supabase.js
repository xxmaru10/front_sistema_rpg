const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manual env reading to avoid dotenv dependency
const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const env = {};
envFile.split('\n').filter(line => line.trim()).forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('URL:', supabaseUrl);
console.log('KEY (first 10 chars):', supabaseAnonKey?.substring(0, 10));

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: Environment variables not found. Check .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
    try {
        console.log('Querying sessions table...');
        const { data, error } = await supabase
            .from('sessions')
            .select('id, name')
            .limit(5);

        if (error) {
            console.error('Supabase Query Error:', error);
        } else {
            console.log('Successfully connected and queried sessions table.');
            console.log('Data found:', data);
        }
    } catch (err) {
        console.error('Caught Exception:', err);
    }
}

testConnection();
