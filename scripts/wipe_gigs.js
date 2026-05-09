const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function wipeDatabase() {
    console.log("Starting DB wipe...");

    // We must delete dependent tables first due to foreign keys.
    const tables = [
        'messages',
        'deliveries',
        'applications',
        'disputes',
        'escrow_events',
        'escrow',
        'ratings',
        'transactions',
        'payout_queue',
        'chat_blocked_logs',
        'gigs'
    ];

    for (const table of tables) {
        console.log(`Wiping ${table}...`);
        // Using 'id.neq.00000000-0000-0000-0000-000000000000' to match all UUIDs
        const { error } = await supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
            
        if (error) {
            console.error(`Error wiping ${table}:`, error.message);
        } else {
            console.log(`Successfully wiped ${table}.`);
        }
    }
    
    console.log("DB wipe complete.");
}

wipeDatabase();
