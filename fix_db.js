
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-client');

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

async function fixSequences() {
    const sessionId = '350b2a59-19fc-4511-9a4f-773b08f93dae';
    console.log(`Fixing sequences for session: ${sessionId}`);

    // 1. Fetch all events ordered by created_at
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${data.length} events.`);

    // 2. Re-assign sequences 1 to N
    for (let i = 0; i < data.length; i++) {
        const event = data[i];
        const newSeq = i + 1;

        if (event.seq !== newSeq) {
            console.log(`Updating event ${event.id}: seq ${event.seq} -> ${newSeq}`);
            const { error: updateError } = await supabase
                .from('events')
                .update({ seq: newSeq })
                .eq('id', event.id);

            if (updateError) console.error(`Failed to update ${event.id}:`, updateError);
        }
    }

    console.log('Sequence fix complete.');
}

fixSequences();
