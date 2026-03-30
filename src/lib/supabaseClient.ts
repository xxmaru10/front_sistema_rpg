import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Durante o build/prerendering do Next.js, as variáveis de ambiente podem não estar presentes.
// Usamos placeholders para evitar que o createClient lance um erro fatal que interrompe o build.
const finalUrl = supabaseUrl || 'https://placeholder-project.supabase.co';
const finalKey = supabaseAnonKey || 'placeholder-anon-key';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Supabase] CRITICAL: Variáveis de ambiente ausentes!');
    if (typeof window !== 'undefined') {
        console.log('[Supabase] URL:', supabaseUrl || 'MISSING', 'Key length:', supabaseAnonKey ? supabaseAnonKey.length : 0);
        // alert("ERRO CRÍTICO: Configuração do Supabase não encontrada! O sistema não conseguirá salvar dados. Verifique o arquivo .env.local.");
    }
} else {
    console.log('[Supabase] Cliente inicializado com sucesso.');
    if (typeof window !== 'undefined') {
        console.log('[Supabase] Target URL:', supabaseUrl);
    }
}

export const supabase = createClient(finalUrl, finalKey, {
    // Configurações de autenticação e banco de dados
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
    db: {
        schema: 'public',
    },
});
