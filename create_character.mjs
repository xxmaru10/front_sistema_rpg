
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

async function createCharacter(sessionId, charData) {
    console.log(`Criando personagem: "${charData.name}" na sessão ${sessionId}...`);

    const charId = charData.id || uuidv4();
    
    // Buscar o próximo seq
    const { data: maxData } = await supabase
        .from('events')
        .select('seq')
        .eq('session_id', sessionId)
        .order('seq', { ascending: false })
        .limit(1);

    const nextSeq = (maxData?.[0]?.seq || 0) + 1;

    const characterPaylod = {
        id: charId,
        name: charData.name,
        ownerUserId: charData.owner || "Daniel",
        isNPC: charData.isNPC || false,
        fatePoints: charData.fatePoints ?? 3,
        refresh: charData.refresh ?? 3,
        stress: charData.stress || {
            physical: [false, false],
            mental: [false, false]
        },
        skills: charData.skills || {},
        consequences: charData.consequences || {
            mild: { text: "" },
            moderate: { text: "" },
            severe: { text: "" }
        },
        stunts: charData.stunts || [],
        spells: charData.spells || [],
        magicLevel: charData.magicLevel ?? 0,
        imageUrl: charData.imageUrl || "",
        biography: charData.biography || "",
        sheetAspects: charData.sheetAspects || ["", "", "", ""],
        activeInArena: true,
        source: charData.source || "active"
    };

    const { error: eventError } = await supabase
        .from('events')
        .insert({
            id: uuidv4(),
            session_id: sessionId,
            seq: nextSeq,
            type: "CHARACTER_CREATED",
            actor_user_id: "SISTEMA",
            visibility: "PUBLIC",
            payload: characterPaylod
        });

    if (eventError) {
        console.error('Erro ao registrar evento "CHARACTER_CREATED":', eventError);
        return;
    }

    console.log('\n✅ Personagem criado com sucesso!');
    console.log(`Nome: ${charData.name}`);
    console.log(`ID: ${charId}`);
}

const zafiraData = {
    id: "f9dab6a5-a595-40d5-960f-0a4158e7154c",
    name: "Zafira Ravaryn",
    owner: "Daniel",
    isNPC: false,
    fatePoints: 3,
    refresh: 3,
    skills: {
        "Lutar": 4,
        "Vontade": -1,
        "Ocultismo": 1,
        "Furtividade": 1,
        "Comunicação": 1,
        "Recursos": 1,
        "Conhecimentos": 1,
        "Atletismo": 1,
        "Enganar": 1
    },
    sheetAspects: [
        "Reservada e um passo à frente (Real) / Elfo Assassina (VT)",
        "Mãe (Real) / Parceiro de missões (VT)",
        "Determinada (Real) / Lâmina oculta (VT)",
        "Culpa silenciosa (Real) / Desconfiança extrema (VT)"
    ],
    stunts: [
        {
            id: uuidv4(),
            name: "Leitura de Ambiente (Real)",
            description: "Zafira consegue perceber mudanças no comportamento das pessoas e no ambiente, identificando tensões, mentiras ou intenções ocultas.",
            cost: "1 ponto de destino"
        },
        {
            id: uuidv4(),
            name: "Sussurro das Sombras (VT)",
            description: "Zafira se funde às sombras e reduz drasticamente sua presença, tornando-se quase impossível de detectar por inimigos distraídos.",
            cost: "2 pontos de destino"
        },
        {
            id: uuidv4(),
            name: "Marca da Caçadora (VT)",
            description: "Análise do inimigo para identificar seu ponto fraco, aumentando o dano do próximo ataque.",
            cost: "2 pontos de destino"
        }
    ]
};

const sessionId = "3d6b11d4"; // Quimeras
createCharacter(sessionId, zafiraData);
