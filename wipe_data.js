
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

async function cleanSession() {
    const sessionId = '350b2a59';
    console.log(`Cleaning session ${sessionId}...`);
    
    let allEvents = [];
    let hasMore = true;
    let offset = 0;

    while (hasMore) {
        const { data, error } = await client
            .from('events')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true })
            .range(offset, offset + 999);

        if (error) {
            console.error("Error fetching events:", error);
            break;
        }

        allEvents = allEvents.concat(data);
        offset += data.length;
        if (data.length < 1000) hasMore = false;
    }

    console.log(`Total events fetched: ${allEvents.length}`);

    // Identifying characters to keep
    const characterIdsToKeep = new Set();
    const deletedCharacterIds = new Set();

    // Map to track the "current state" of source/isNPC
    const characterTypeMap = new Map();

    allEvents.forEach(e => {
        if (e.type === 'CHARACTER_CREATED') {
            const char = e.payload;
            if (char.source === 'bestiary' || !char.isNPC) {
                characterIdsToKeep.add(char.id);
            }
            characterTypeMap.set(char.id, char.source);
        }
        if (e.type === 'CHARACTER_DELETED') {
            // If it was deleted, we don't need to keep its history (maybe)
            // But the user said "apague todos os dados exceto jogadores e bestiario"
            // Usually means keep the "active" ones.
            // If I keep the CREATED event for a deleted one, it reappears. 
            // So I should only keep those that are NOT deleted.
            deletedCharacterIds.add(e.payload.characterId);
        }
    });

    const activeKeepers = new Set([...characterIdsToKeep].filter(id => !deletedCharacterIds.has(id)));
    console.log(`Active players/bestiary characters found: ${activeKeepers.size}`);

    const eventsToKeep = allEvents.filter(e => {
        // Essential session events
        if (e.type === 'SESSION_CREATED') return true;
        if (e.type === 'SESSION_CODES_UPDATED') return true;
        
        // Character related events for our keepers
        if (e.type.startsWith('CHARACTER_')) {
            const charId = e.payload.id || e.payload.characterId;
            if (activeKeepers.has(charId)) return true;
        }
        if (e.type.startsWith('STRESS_')) {
            if (activeKeepers.has(e.payload.characterId)) return true;
        }

        // Keep ONE theme preset update (the last one)
        // (Handled by filter later or just keep all theme for now but 8k events had thousands)
        
        return false;
    });

    // Handle Theme Preset: keep only the latest
    const latestTheme = allEvents.filter(e => e.type === 'SESSION_THEME_PRESET_UPDATED').pop();
    if (latestTheme) eventsToKeep.push(latestTheme);

    console.log(`Events to keep: ${eventsToKeep.length}`);

    const idsToDelete = allEvents.map(e => e.id).filter(id => !eventsToKeep.some(keeper => keeper.id === id));
    console.log(`Events to delete: ${idsToDelete.length}`);

    if (idsToDelete.length === 0) {
        console.log("Nothing to delete.");
        return;
    }

    // Delete in chunks of 500
    for (let i = 0; i < idsToDelete.length; i += 500) {
        const chunk = idsToDelete.slice(i, i + 500);
        console.log(`Deleting chunk ${i/500 + 1}...`);
        const { error } = await client
            .from('events')
            .delete()
            .in('id', chunk);
        
        if (error) {
            console.error("Error deleting chunk:", error);
        }
    }

    console.log("Cleanup complete!");
}

cleanSession();
