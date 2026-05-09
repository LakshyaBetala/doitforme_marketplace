const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // Check if companies table exists and has a specific column, or just fetch one row
  const { data, error } = await supabase.from('companies').select('*').limit(1);
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Companies Schema Keys:", Object.keys(data[0] || {}));
  }
}

run();
