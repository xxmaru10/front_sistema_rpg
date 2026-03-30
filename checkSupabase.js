const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tqckkjqxyshreugsvroy.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2tranF4eXNocmV1Z3N2cm95Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc3ODMzNCwiZXhwIjoyMDg0MzU0MzM0fQ.uqkIlLVpbxZt5oumYCecwv19bVQTgBxTg3v-N237Lqg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSessions() {
    console.log('--- TESTE DE CHAVE MESTRA (SERVICE ROLE) ---');
    console.log('Fetching sessions from:', supabaseUrl);
    
    // Test direct REST call with fetch too as a backup
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .limit(5);

        if (error) {
            console.error('Error with Supabase lib:', error);
        } else {
            console.log('SUCCESS with Supabase lib! Sessions found:', data.length);
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error('Exception with Supabase lib:', err.message);
    } finally {
        clearTimeout(timeoutId);
        process.exit(0);
    }
}

checkSessions();
