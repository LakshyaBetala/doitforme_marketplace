const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
envLocal.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key.trim()] = value.trim();
  }
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabaseAdmin.rpc('run_sql', {
    query: "ALTER TABLE gigs ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;"
  });
  if (error) {
     console.error("RPC failed. Cannot alter table dynamically via RPC. Using an alternate strategy.", error);
  } else {
     console.log("Column added successfully via RPC");
  }
}
run();
