
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value.length > 0) {
        env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
    }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function createCharacter(sessionId, charData) {
    console.log(`Criando personagem: "${charData.name}" na sessão ${sessionId}...`);

    const charId = charData.id || uuidv4();

    const { data: maxData } = await supabase
        .from('events')
        .select('seq')
        .eq('session_id', sessionId)
        .order('seq', { ascending: false })
        .limit(1);

    const nextSeq = (maxData?.[0]?.seq || 0) + 1;

    const characterPayload = {
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
            payload: characterPayload
        });

    if (eventError) {
        console.error('Erro ao registrar evento "CHARACTER_CREATED":', eventError);
        return;
    }

    console.log('\n✅ Personagem criado com sucesso!');
    console.log(`Nome: ${charData.name}`);
    console.log(`ID: ${charId}`);
}

const salomaoData = {
    id: "8af40606-69d5-4960-b0d4-ac929d8cae97",
    name: "Salomão Castaigne",
    owner: "Salomão Castaigne",
    isNPC: false,
    fatePoints: 3,
    refresh: 3,
    skills: {
        "Recursos": 4,
        "Condução": -1,
        "Lutar": 1,
        "Atletismo": 1,
        "Comunicação": 1,
        "Contatos": 1,
        "Vigor": 1,
        "Provocar": 1,
        "Vontade": 1,
        "Conhecimentos": 1
    },
    sheetAspects: [
        // Aspecto 0: Frase Real / Frase Virtual
        "Herdeiro da família de banqueiros Castaigne (Real) / Orc boxeador em ascensão (VT)",
        // Aspecto 1: Relacionamento Real / Relacionamento Virtual
        "Seu grupo de conselheiros da família Castaigne (Real) / Seu treinador, Hastur \"Maguila\" Reznor (VT)",
        // Aspecto 2: Aspecto Real / Aspecto Virtual
        "Como um herdeiro Castaigne, Salomão pode ter acesso a pequenas vantagens no mundo virtual, falando com a pessoa certa",
        // Aspecto 3 (Dificuldade/Defeito): Defeito Real / Defeito Virtual
        "Tendência a ter momentos de loucura - O Rei de Amarelo (Real) / Propenso a ataques de raiva (VT)"
    ],
    stunts: [
        {
            id: uuidv4(),
            name: "Riqueza Castaigne (Real)",
            description: "Como herdeiro da família Castaigne, Salomão é poderosamente rico. Sua riqueza e infâmia permite que ele use sua riqueza como influência, afinal, os Castaigne sempre pagam suas dívidas. Permite usar Recursos em vez de Contatos.",
            cost: "1"
        },
        {
            id: uuidv4(),
            name: "Guarda-costas de Elite (VT)",
            description: "Como o Grande Ben Yahu é um orc vindo de família rica, mas tentando ascender por si próprio, sua família ainda tenta ajudar enviando guarda-costas de elite para ajudar em algumas situações mais perigosas. Permite usar Recursos em vez de Lutar.",
            cost: "1"
        },
        {
            id: uuidv4(),
            name: "3000 Anos (VT)",
            description: "A influência do Grande Ben Yahu é sentida. Todos ao seu redor sabem que a vitória dele é garantida e foi prometida a 3000 anos. Uma vez por sessão, permite que ele invoque os créditos dos seus antepassados, permitindo ele resolucionar qualquer conflito social.",
            cost: "1 (1x por sessão)"
        }
    ],
    biography: "MUNDO REAL: Salomão Castaigne — Herdeiro da família de banqueiros Castaigne, gasta rios de dinheiro em expedições arqueológicas em busca das últimas páginas do Rei de Amarelo.\n\nMUNDO VIRTUAL: O Grande Ben Yahu — Orc boxeador em ascensão."
};

const sessionId = "3d6b11d4"; // Quimeras
createCharacter(sessionId, salomaoData);
