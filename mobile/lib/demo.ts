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

// ---- Inner Circle fixtures -------------------------------------------------------------
// One brief per workflow state (shared/innerCircle.ts workflowFor), so every step of the tracker
// can be seen without a real account. All assigned to the demo user.
const ahead = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const icGigs = [
  { id: 'ig1', title: 'Landing page for a fintech launch', description: 'Responsive marketing page in React, handed over with a short README.', price: 12000, status: 'assigned', payment_status: 'ESCROW_FUNDED', listing_type: 'COMPANY_TASK', category: 'DEVELOPMENT', poster_id: 'u3', company_id: 'c1', company_name: 'Acme Studio', assigned_worker_id: 'demo', created_at: ago(40), images: [] },
  { id: 'ig2', title: 'Brand identity refresh', description: 'Logo refinement, colour system and a one-page usage guide.', price: 8500, status: 'DELIVERED', payment_status: 'HELD', listing_type: 'COMPANY_TASK', category: 'DESIGN', poster_id: 'u3', company_id: 'c2', company_name: 'Northwind Labs', assigned_worker_id: 'demo', delivered_at: ago(5), auto_release_at: ahead(19), created_at: ago(120), images: [] },
  { id: 'ig3', title: 'Data cleanup and sales dashboard', description: 'Clean three spreadsheets and build a simple dashboard.', price: 6000, status: 'DELIVERED', payment_status: 'HELD', dispute_reason: 'Scope disagreement on the dashboard', listing_type: 'COMPANY_TASK', category: 'DATA', poster_id: 'u3', company_id: 'c3', company_name: 'Kiln & Co', assigned_worker_id: 'demo', delivered_at: ago(30), created_at: ago(200), images: [] },
  { id: 'ig4', title: 'Pitch deck redesign', description: '14 slides, speaker notes, exported to PDF.', price: 4500, status: 'completed', payment_status: 'RELEASED', listing_type: 'COMPANY_TASK', category: 'DESIGN', poster_id: 'u3', company_id: 'c4', company_name: 'Orbit Foods', assigned_worker_id: 'demo', delivered_at: ago(300), created_at: ago(400), images: [] },
  { id: 'ig5', title: 'Mobile onboarding flow', description: 'Three-screen onboarding in Figma with a clickable prototype.', price: 9000, status: 'assigned', payment_status: 'PENDING', listing_type: 'COMPANY_TASK', category: 'DESIGN', poster_id: 'u3', company_id: 'c1', company_name: 'Acme Studio', assigned_worker_id: 'demo', created_at: ago(6), images: [] },
];
const payout_queue = [{ id: 'p1', gig_id: 'ig4', worker_id: 'demo', status: 'completed', amount: 4275 }];

const day = (d: number) => new Date(Date.now() + d * 86400_000).toISOString();
const outreach_leads = [
  { id: 'l1', company_name: 'Zephyr Logistics', contact_name: 'Meera Kapoor', contact_email: 'meera@zephyr.example', contact_phone: '9000000001', website: 'zephyr.example', source: 'LinkedIn', stage: 'contacted', value_estimate: 40000, next_action_at: day(-3), notes: 'Asked for a portfolio. Follow up with two case studies.', owner_id: 'demo', last_touch_at: ago(90) },
  { id: 'l2', company_name: 'Brightside Health', contact_name: 'Arjun Rao', contact_email: 'arjun@brightside.example', contact_phone: null, website: 'brightside.example', source: 'Referral', stage: 'replied', value_estimate: 25000, next_action_at: day(-1), notes: 'Wants a call about onboarding screens.', owner_id: 'demo', last_touch_at: ago(30) },
  { id: 'l3', company_name: 'Lumen Books', contact_name: 'Sana Iqbal', contact_email: 'sana@lumen.example', contact_phone: '9000000003', website: null, source: 'Campus fair', stage: 'meeting', value_estimate: 60000, next_action_at: day(2), notes: 'Call booked. Bring the brief template.', owner_id: 'demo', last_touch_at: ago(8) },
  { id: 'l4', company_name: 'Tilt Fitness', contact_name: null, contact_email: null, contact_phone: null, website: 'tilt.example', source: 'Instagram', stage: 'new', value_estimate: null, next_action_at: day(0.5), notes: null, owner_id: 'demo', last_touch_at: null },
  { id: 'l5', company_name: 'Harbor Coffee', contact_name: 'Dev Malhotra', contact_email: 'dev@harbor.example', contact_phone: '9000000005', website: 'harbor.example', source: 'Walk-in', stage: 'won', value_estimate: 18000, next_action_at: null, notes: 'Posted their first brief.', owner_id: 'demo', last_touch_at: ago(200) },
  { id: 'l6', company_name: 'Plum Analytics', contact_name: 'Ira Sen', contact_email: 'ira@plum.example', contact_phone: null, website: 'plum.example', source: 'Cold email', stage: 'lost', value_estimate: 30000, next_action_at: null, notes: 'Budget frozen until next quarter.', owner_id: 'u1', last_touch_at: ago(400) },
];

const notifications = [
  { id: 'n1', user_id: 'demo', type: 'gig', content: 'Northwind Labs is reviewing your delivery for Brand identity refresh.', link: '/gig/ig2', is_read: false, created_at: ago(2) },
  { id: 'n2', user_id: 'demo', type: 'gig', content: 'Acme Studio funded escrow for Landing page for a fintech launch.', link: '/gig/ig1', is_read: false, created_at: ago(26) },
  { id: 'n3', user_id: 'demo', type: 'payout', content: 'Your payout for Pitch deck redesign was sent to your UPI.', link: '/payouts', is_read: true, created_at: ago(70) },
];

const icMessages = [
  { id: 'im1', gig_id: 'ig1', sender_id: 'u3', receiver_id: 'demo', content: 'Brand assets are in the shared folder. Shout if anything is missing.', message_type: 'text', created_at: ago(3), gig: { title: icGigs[0].title, poster_id: 'u3', assigned_worker_id: 'demo' } },
  { id: 'im2', gig_id: 'ig2', sender_id: 'demo', receiver_id: 'u3', content: 'Delivered the final files, happy to tweak anything.', message_type: 'text', created_at: ago(5), gig: { title: icGigs[1].title, poster_id: 'u3', assigned_worker_id: 'demo' } },
];

// Which kind of member the demo is signed in as. Set by startDemo(persona) in lib/session.tsx.
export type Persona = 'TECH' | 'OUTREACH' | 'APPLICANT' | 'PENDING';
const apps: Record<string, any[]> = {
  TECH: [],
  OUTREACH: [],
  APPLICANT: [],
  PENDING: [{ id: 'ia1', user_id: 'demo', status: 'pending', role: 'TECH', decision_note: null, created_at: ago(30) }],
};
let currentPersona: Persona = 'TECH';
export function setPersona(p: Persona) {
  currentPersona = p;
  Object.assign(users[0], {
    name: 'Aarav Mehta',
    username: 'aarav',
    is_elite: p === 'TECH' || p === 'OUTREACH',
    inner_circle_role: p === 'TECH' || p === 'OUTREACH' ? p : null,
    upi_id: 'aarav@okbank',
    total_earned: 4275,
    created_at: ago(24 * 60),
  });
}
setPersona('TECH');

const tables: Record<string, any[]> = {
  users,
  gigs: [...gigs, ...icGigs],
  applications,
  messages: icMessages,
  companies: [],
  payout_queue,
  outreach_leads,
  notifications,
  get inner_circle_applications() {
    return apps[currentPersona];
  },
};

// Rows the screens expect joined in, which PostgREST would have embedded.
const embed = (table: string, row: any) => {
  if (table === 'outreach_leads') return { ...row, owner: { name: users.find((u) => u.id === row.owner_id)?.name ?? null } };
  if (table !== 'gigs') return row;
  const owner = users.find((u) => u.id === row.poster_id);
  const worker = users.find((u) => u.id === row.assigned_worker_id);
  const count = applications.filter((a) => a.gig_id === row.id).length;
  return {
    ...row,
    users: { college: owner?.college ?? null },
    companies: row.company_id ? { name: row.company_name ?? 'Acme Studio' } : null,
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
