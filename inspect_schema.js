
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tqckkjqxyshreugsvroy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2tranF4eXNocmV1Z3N2cm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NzgzMzQsImV4cCI6MjA4NDM1NDMzNH0.6H_IJWdOGZr_JTn6_-DbMbNWb91Ye8A6QVDUPtRXw2A';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSession() {
    const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Session Keys:', data && data.length > 0 ? Object.keys(data[0]) : 'No data');
        console.log('Sample Data:', data);
    }
}

inspectSession();
