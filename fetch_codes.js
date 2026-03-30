
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tqckkjqxyshreugsvroy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2tranF4eXNocmV1Z3N2cm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NzgzMzQsImV4cCI6MjA4NDM1NDMzNH0.6H_IJWdOGZr_JTn6_-DbMbNWb91Ye8A6QVDUPtRXw2A';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getAllSessionCodes() {
    console.log("Buscando sessões e códigos...");

    // 1. Buscar todos os eventos de criação de sessão
    const { data: creationEvents, error: creationError } = await supabase
        .from('events')
        .select('*')
        .eq('type', 'SESSION_CREATED')
        .order('created_at', { ascending: false });

    if (creationError) {
        console.error('Erro ao buscar SESSION_CREATED:', creationError);
        return;
    }

    // 2. Buscar todos os eventos de atualização de códigos
    const { data: updateEvents, error: updateError } = await supabase
        .from('events')
        .select('*')
        .eq('type', 'SESSION_CODES_UPDATED')
        .order('created_at', { ascending: false });

    if (updateError) {
        console.error('Erro ao buscar SESSION_CODES_UPDATED:', updateError);
        return;
    }

    const sessions = {};

    // Processar criações
    creationEvents.forEach(e => {
        if (!sessions[e.session_id]) {
            sessions[e.session_id] = {
                id: e.session_id,
                name: e.payload.name || "Sessão sem nome",
                gmCode: e.payload.gmCode || `${e.session_id}-GM`,
                playerCode: e.payload.playerCode || e.session_id,
                updatedAt: e.created_at
            };
        }
    });

    // Processar atualizações (sobrescrever com o mais recente)
    updateEvents.forEach(e => {
        if (sessions[e.session_id]) {
            // Se o evento de atualização for mais recente que o que temos
            if (new Date(e.created_at) > new Date(sessions[e.session_id].updatedAt)) {
                sessions[e.session_id].gmCode = e.payload.gmCode;
                sessions[e.session_id].playerCode = e.payload.playerCode;
                sessions[e.session_id].updatedAt = e.created_at;
            }
        } else {
            sessions[e.session_id] = {
                id: e.session_id,
                name: "Sessão Desconhecida",
                gmCode: e.payload.gmCode,
                playerCode: e.payload.playerCode,
                updatedAt: e.created_at
            };
        }
    });

    console.log("\n=== CÓDIGOS DAS SESSÕES ===");
    Object.values(sessions).forEach(s => {
        console.log(`\nSessão: ${s.name} (${s.id})`);
        console.log(`  Mestre: ${s.gmCode}`);
        console.log(`  Jogador: ${s.playerCode}`);
    });
}

getAllSessionCodes();
