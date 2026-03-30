
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

async function createSession(gmName, sessionName) {
    console.log(`Criando sessão: "${sessionName}" para o mestre: "${gmName}"...`);

    const sessionId = uuidv4().slice(0, 8);
    const gmCode = `${sessionId}-GM`;
    const playerCode = sessionId;

    // 1. Inserir na tabela sessions
    const { error: sessionError } = await supabase
        .from('sessions')
        .insert({
            id: sessionId,
            name: sessionName.trim(),
            gm_user_id: gmName.trim()
        });

    if (sessionError) {
        console.error('Erro ao criar sessão na tabela "sessions":', sessionError);
        return;
    }

    // 2. Inserir evento SESSION_CREATED na tabela events
    const { error: eventError } = await supabase
        .from('events')
        .insert({
            id: uuidv4(),
            session_id: sessionId,
            seq: 1, // Primeiro evento
            type: "SESSION_CREATED",
            actor_user_id: gmName.trim(),
            visibility: "PUBLIC",
            payload: {
                sessionId,
                name: sessionName.trim(),
                gmCode: gmCode.toUpperCase(),
                playerCode: playerCode.toUpperCase()
            }
        });

    if (eventError) {
        console.error('Erro ao registrar evento "SESSION_CREATED":', eventError);
        return;
    }

    console.log('\n✅ Sessão criada com sucesso!');
    console.log(`ID da Sessão: ${sessionId}`);
    console.log(`Nome da Sessão: ${sessionName}`);
    console.log(`Mestre: ${gmName}`);
    console.log('-----------------------------------');
    console.log(`Código do Mestre:  ${gmCode.toUpperCase()}`);
    console.log(`Código do Jogador: ${playerCode.toUpperCase()}`);
    console.log('-----------------------------------');
    console.log(`URL sugerida: /session/${sessionId}?u=${encodeURIComponent(gmName)}&r=GM`);
}

// Ler argumentos da linha de comando
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Uso: node create_session.mjs "Nome do Mestre" "Nome da Mesa"');
    process.exit(1);
}

const [gmName, sessionName] = args;
createSession(gmName, sessionName);
