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
  const { data, error } = await supabaseAdmin.from('users').select('*').limit(1);
  if (error) {
     console.error(error);
  } else {
     console.log("Users Schema Keys:", Object.keys(data[0] || {}));
  }
  
  const { data: cData } = await supabaseAdmin.from('companies').select('*').limit(1);
  console.log("Companies Schema Keys:", Object.keys(cData[0] || {}));
  
  const { data: gData } = await supabaseAdmin.from('gigs').select('*').limit(1);
  console.log("Gigs Schema Keys:", Object.keys(gData[0] || {}));
}
run();
