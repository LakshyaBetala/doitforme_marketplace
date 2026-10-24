// Demo mode: sample data so the app can be tried with no account and no backend.
// Only reachable when EXPO_PUBLIC_DEMO=1, which eas.json sets for the preview
// profile and NOT for production. Mirrors lib/devPreview.ts on the web.
export const DEMO_ENABLED = process.env.EXPO_PUBLIC_DEMO === '1';

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const users = [
  { id: 'demo', name: 'Demo Student', phone: '9999999999', college: 'IIT Demo', avatar_url: null, rating: 4.8, rating_count: 12, jobs_completed: 7, kyc_status: 'approved', kyc_verified: true },
  { id: 'u1', name: 'Riya Sharma', college: 'IIT Demo', rating: 4.9 },
  { id: 'u2', name: 'Kabir Singh', college: 'NIT Sample', rating: 4.5 },
  { id: 'u3', name: 'Acme Studio', college: null, rating: null },
];

const gigs = [
  { id: 'g1', title: 'Design a logo for a college fest', description: 'Need a clean, modern logo and a one-page usage guide. Source files in vector format.', price: 1500, status: 'open', listing_type: 'HUSTLE', category: 'DESIGN', location: 'Remote', poster_id: 'u1', created_at: ago(3), is_featured: true, images: [] },
  { id: 'g2', title: 'Summarise 3 research papers', description: 'One page per paper, plain English, due in 3 days.', price: 600, status: 'open', listing_type: 'HUSTLE', category: 'WRITING', location: 'Remote', poster_id: 'u2', created_at: ago(20), images: [] },
  { id: 'g3', title: 'Social media intern (2 months)', description: 'Plan and schedule posts for a growing startup. Stipend based on output.', price: 8000, status: 'open', listing_type: 'COMPANY_TASK', category: 'MARKETING', location: 'Remote', poster_id: 'u3', company_id: 'c1', created_at: ago(70), images: [] },
  { id: 'g4', title: 'Build a landing page in React', description: 'Single page, responsive, deployed on Vercel.', price: 3000, status: 'open', listing_type: 'HUSTLE', category: 'DEVELOPMENT', location: 'Remote', poster_id: 'u2', created_at: ago(30), images: [] },
  // Posted by the demo user, so they show up under Hiring.
  { id: 'g5', title: 'Proofread my thesis introduction', description: '2,000 words, fix grammar and flow.', price: 400, status: 'assigned', listing_type: 'HUSTLE', category: 'WRITING', location: 'Remote', poster_id: 'demo', assigned_worker_id: 'u1', created_at: ago(48), images: [] },
];

const applications = [
  { id: 'a1', gig_id: 'g1', worker_id: 'demo', status: 'pending', created_at: ago(2), gig: { ...gigs[0], poster: { name: 'Riya Sharma', phone: null } } },
  { id: 'a2', gig_id: 'g4', worker_id: 'demo', status: 'accepted', created_at: ago(26), gig: { ...gigs[3], poster: { name: 'Kabir Singh', phone: null } } },
  { id: 'a3', gig_id: 'g5', worker_id: 'u1', status: 'accepted', created_at: ago(50) },
];

const messages = [
  { id: 'm1', gig_id: 'g4', sender_id: 'u2', receiver_id: 'demo', content: 'Hi! Can you start today?', message_type: 'text', created_at: ago(1), gig: { title: gigs[3].title, poster_id: 'u2', assigned_worker_id: 'demo' } },
  { id: 'm2', gig_id: 'g5', sender_id: 'demo', receiver_id: 'u1', content: 'Sent over the draft, let me know.', message_type: 'text', created_at: ago(5), gig: { title: gigs[4].title, poster_id: 'demo', assigned_worker_id: 'u1' } },
];

const tables: Record<string, any[]> = { users, gigs, applications, messages, companies: [] };

// Rows the screens expect joined in, which PostgREST would have embedded.
const embed = (table: string, row: any) => {
  if (table !== 'gigs') return row;
  const owner = users.find((u) => u.id === row.poster_id);
  const worker = users.find((u) => u.id === row.assigned_worker_id);
  const count = applications.filter((a) => a.gig_id === row.id).length;
  return {
    ...row,
    users: { college: owner?.college ?? null },
    companies: row.company_id ? { name: 'Acme Studio' } : null,
    worker: worker ? { name: worker.name, phone: null } : null,
    applications: [{ count }],
  };
};

function builder(table: string) {
  const eq: Record<string, unknown> = {};
  let single = false;
  let head = false;
  let write = false;
  const run = () => {
    // Demo data is read-only: a write must fail, not pretend to succeed.
    if (write) return { data: null, error: { message: 'Demo mode: changes are switched off.' } };
    let rows = (tables[table] ?? [])
      .filter((r) => Object.entries(eq).every(([k, v]) => k.includes('.') || r[k] === v))
      .map((r) => embed(table, r));
    if (head) return { data: null, count: rows.length, error: null };
    if (single) {
      return rows[0]
        ? { data: rows[0], error: null }
        : { data: null, error: { message: 'Not found (demo data)' } };
    }
    return { data: rows, error: null };
  };
  const chain: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'then') return (ok: any, bad: any) => Promise.resolve(run()).then(ok, bad);
        if (prop === 'insert' || prop === 'update' || prop === 'upsert' || prop === 'delete') return () => ((write = true), chain);
        if (prop === 'eq') return (col: string, val: unknown) => ((eq[col] = val), chain);
        if (prop === 'single' || prop === 'maybeSingle') return () => ((single = true), chain);
        if (prop === 'select') return (_cols?: string, opts?: { head?: boolean }) => ((head = Boolean(opts?.head)), chain);
        return () => chain; // order, range, or, in, is, gt, limit: filters are ignored in demo
      },
    },
  );
  return chain;
}

export const demoClient = {
  from: (table: string) => builder(table),
  storage: {
    from: () => ({
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
      upload: async () => ({ data: null, error: { message: 'Demo mode: uploads are switched off.' } }),
      createSignedUrl: async () => ({ data: null, error: { message: 'Demo mode.' } }),
    }),
  },
};

export const demoSession: any = { user: { id: 'demo', email: 'demo@doitforme.in' } };
export const demoProfile = users[0];
