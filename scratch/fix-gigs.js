const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixGigs() {
  const { data: gigs, error } = await supabase.from('gigs').select('id, max_workers, status').eq('status', 'assigned');
  if (error) { console.error('Error fetching gigs:', error); return; }
  
  for (const gig of gigs) {
    const { count } = await supabase.from('applications').select('*', { count: 'exact', head: true }).eq('gig_id', gig.id).in('status', ['accepted', 'approved']);
    if (count < (gig.max_workers || 1)) {
      console.log(`Fixing gig ${gig.id}: count ${count} < max_workers ${gig.max_workers}`);
      await supabase.from('gigs').update({ status: 'open' }).eq('id', gig.id);
    }
  }
  console.log('Done fixing gigs.');
}

fixGigs();
