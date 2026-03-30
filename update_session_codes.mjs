
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente do .env.local
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
    console.error('Arquivo .env.local não encontrado!');
    process.exit(1);
}

const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value.length > 0) {
        env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Configurações do Supabase ausentes no .env.local!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function updateSessionCodes(sessionId, gmCode, playerCode) {
    console.log(`Atualizando códigos para a sessão ${sessionId}...`);
    console.log(`Novo código GM: ${gmCode}`);
    console.log(`Novo código Player: ${playerCode}`);

    // Inserir evento SESSION_CODES_UPDATED na tabela events
    // Precisamos pegar o último 'seq' dessa sessão
    const { data: maxData, error: maxError } = await supabase
        .from('events')
        .select('seq')
        .eq('session_id', sessionId)
        .order('seq', { ascending: false })
        .limit(1);

    let nextSeq = 1;
    if (!maxError && maxData && maxData.length > 0) {
        nextSeq = (maxData[0].seq || 0) + 1;
    }

    const { error: eventError } = await supabase
        .from('events')
        .insert({
            id: uuidv4(),
            session_id: sessionId,
            seq: nextSeq,
            type: "SESSION_CODES_UPDATED",
            actor_user_id: "SISTEMA",
            visibility: "PUBLIC",
            payload: {
                gmCode: gmCode.toUpperCase(),
                playerCode: playerCode.toUpperCase()
            }
        });

    if (eventError) {
        console.error('Erro ao registrar evento "SESSION_CODES_UPDATED":', eventError);
        return;
    }

    console.log('\n✅ Códigos atualizados com sucesso!');
}

// Ler argumentos da linha de comando
const args = process.argv.slice(2);
if (args.length < 3) {
    console.log('Uso: node update_session_codes.mjs <sessionId> <gmCode> <playerCode>');
    process.exit(1);
}

const [sessionId, gmCode, playerCode] = args;
updateSessionCodes(sessionId, gmCode, playerCode);
