/**
 * Dev preview — render the real signed-in pages without a backend.
 *
 * WHY THIS EXISTS. Supabase is answering 402 on REST, Auth and Storage, so there
 * is no way to look at the product: proxy.ts redirects every workspace route to
 * /login because auth.getUser() fails, and even past the gate every page would
 * render its empty state because no query returns anything. The redesign is
 * therefore unreviewable at exactly the moment it most needs reviewing.
 *
 * /design-lab covers the components. This covers the PAGES — /dashboard, /feed,
 * /activity, /messages, /profile, the Inner Circle — with fixtures, so the
 * layouts, the real data-shaping code and the states that only appear when there
 * IS data can all be seen.
 *
 * ── WHY THIS CANNOT LEAK INTO PRODUCTION ──────────────────────────────────────
 *
 * It is behind two locks, and the first one cannot be flipped by configuration:
 *
 *   process.env.NODE_ENV !== "production"
 *       A compile-time constant in both the server and the client bundle. In a
 *       production build this folds to `false`, so DEV_PREVIEW is `false`, every
 *       branch below is unreachable and the fixtures are tree-shaken out of the
 *       bundle entirely. Setting the env var on the deployed Worker does nothing.
 *
 *   process.env.NEXT_PUBLIC_DEV_PREVIEW === "1"
 *       Opt-in, so a normal `npm run dev` is unaffected and still talks to the
 *       real Supabase.
 *
 * An auth bypass is the single most dangerous thing to add to this codebase —
 * the gate is what stands in front of escrow, KYC documents and other people's
 * contact details. One lock would not have been enough; `NODE_ENV` is the one
 * that makes it structurally impossible rather than merely unlikely.
 *
 *   npm run dev:preview        # or DEV_PREVIEW_ROLE=OUTREACH npm run dev:preview
 */

export const DEV_PREVIEW =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_DEV_PREVIEW === "1";

/** Which Inner Circle surface to show. TECH gets briefs, OUTREACH gets the CRM. */
const ROLE = (process.env.NEXT_PUBLIC_DEV_PREVIEW_ROLE === "OUTREACH" ? "OUTREACH" : "TECH") as
  | "TECH"
  | "OUTREACH";

const ME = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const ahead = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

export const PREVIEW_USER = {
  id: ME,
  email: "alex@christuniversity.in",
  user_metadata: { name: "Alex Kumar" },
  app_metadata: {},
  aud: "authenticated",
  created_at: ago(24 * 90),
};

/**
 * Fixtures, shaped to exercise the states that only exist when there IS data —
 * which are the ones nobody ever sees while building. Between them these produce
 * every branch of the Overview action list: applicants to pick, escrow to fund,
 * work to review, work to submit, and something waiting on someone else.
 */
const FIXTURES: Record<string, any[]> = {
  users: [
    {
      id: ME,
      name: "Alex Kumar",
      email: "alex@christuniversity.in",
      role: "STUDENT",
      phone: "9876543210",
      college: "Christ University",
      upi_id: "alex@okhdfcbank",
      bio: "Final year CS. I build web apps and design decks. Fast replies, no drama.",
      avatar_url: null,
      is_elite: true,
      inner_circle_role: ROLE,
      kyc_verified: true,
      kyc_status: "approved",
      rating: 4.8,
      rating_count: 12,
      jobs_completed: 9,
      points_balance: 120,
      referral_code: "ALEX120",
      preferences: ["Tech & Engineering", "Design & Creative"],
      created_at: ago(24 * 200),
    },
    { id: OTHER, name: "Priya Nair", college: "VIT Chennai", rating: 4.9, rating_count: 31, jobs_completed: 22 },
  ],

  gigs: [
    // Posted by me — four different things needing four different actions.
    {
      id: "g-applicants", poster_id: ME, title: "Design a poster for our fest",
      price: 1200, status: "open", payment_status: null, listing_type: "HUSTLE",
      assigned_worker_id: null, source_service_id: null, is_physical: false,
      location: "Remote", created_at: ago(5), applications: [{ count: 4 }],
      users: { college: "Christ University" },
    },
    {
      id: "g-fund", poster_id: ME, title: "Edit a 3-minute recap video",
      price: 3000, status: "assigned", payment_status: "PENDING", listing_type: "HUSTLE",
      assigned_worker_id: OTHER, source_service_id: null, is_physical: false,
      location: "Remote", created_at: ago(26), applications: [{ count: 7 }],
      users: { college: "Christ University" },
    },
    {
      id: "g-review", poster_id: ME, title: "Write 5 blog posts on campus life",
      price: 2500, status: "delivered", payment_status: "HELD", listing_type: "HUSTLE",
      assigned_worker_id: OTHER, source_service_id: null, is_physical: false,
      delivered_at: ago(6), auto_release_at: ahead(18),
      location: "Remote", created_at: ago(72), applications: [{ count: 3 }],
      users: { college: "Christ University" },
    },

    // Assigned to me — one to deliver, one already waiting on the client.
    {
      id: "g-deliver", poster_id: OTHER, title: "Build a React dashboard for internal analytics",
      price: 18000, status: "assigned", payment_status: "HELD", listing_type: "COMPANY_TASK",
      assigned_worker_id: ME, source_service_id: null, is_physical: true,
      location: "Bengaluru", created_at: ago(48), company_id: "c-nexa",
      companies: { name: "Nexa Labs" }, applications: [{ count: 11 }],
      users: { college: "VIT Chennai" },
    },
    {
      id: "g-waiting", poster_id: OTHER, title: "Landing page copy for a D2C brand",
      price: 6000, status: "delivered", payment_status: "HELD", listing_type: "COMPANY_TASK",
      assigned_worker_id: ME, source_service_id: null, is_physical: false,
      delivered_at: ago(3), auto_release_at: ahead(21),
      location: "Remote", created_at: ago(120), company_id: "c-vera",
      companies: { name: "Vera Goods" }, applications: [{ count: 5 }],
      users: { college: "VIT Chennai" },
    },
    {
      id: "g-paid", poster_id: OTHER, title: "Instagram carousel set, 6 slides",
      price: 2200, status: "completed", payment_status: "RELEASED", listing_type: "HUSTLE",
      assigned_worker_id: ME, source_service_id: null, is_physical: false,
      delivered_at: ago(400), location: "Remote", created_at: ago(500),
      users: { college: "VIT Chennai" }, applications: [{ count: 2 }],
    },

    // The open board — what /feed and the Overview glance render.
    {
      id: "g-open-1", poster_id: OTHER, title: "Need a logo for a student startup",
      price: 1500, status: "open", payment_status: null, listing_type: "HUSTLE",
      assigned_worker_id: null, source_service_id: null, is_physical: false,
      location: "Remote", created_at: ago(2), applications: [{ count: 2 }],
      users: { college: "VIT Chennai" },
    },
    {
      id: "g-open-2", poster_id: OTHER, title: "Flutter developer for a 2-week sprint",
      price: 25000, status: "open", payment_status: null, listing_type: "COMPANY_TASK",
      assigned_worker_id: null, source_service_id: null, is_physical: true,
      is_featured: true, location: "Chennai", created_at: ago(9), company_id: "c-nexa",
      companies: { name: "Nexa Labs" }, applications: [{ count: 14 }],
      users: { college: "VIT Chennai" },
    },
    {
      id: "g-open-3", poster_id: OTHER, title: "Proofread a 40-page dissertation",
      price: 900, status: "open", payment_status: null, listing_type: "HUSTLE",
      assigned_worker_id: null, source_service_id: null, is_physical: false,
      location: "Remote", created_at: ago(14), applications: [{ count: 0 }],
      users: { college: "Anna University" },
    },
    {
      id: "g-open-4", poster_id: OTHER, title: "Shoot and edit a 60-second campus reel",
      price: 3500, status: "open", payment_status: null, listing_type: "HUSTLE",
      assigned_worker_id: null, source_service_id: null, is_physical: true,
      location: "Christ University", created_at: ago(30), applications: [{ count: 6 }],
      users: { college: "Christ University" },
    },
  ],

  payout_queue: [
    { id: "p1", worker_id: ME, gig_id: "g-waiting", amount: 5700, status: "PENDING", created_at: ago(3), gig: { title: "Landing page copy for a D2C brand" } },
    { id: "p2", worker_id: ME, gig_id: "g-paid", amount: 2090, status: "COMPLETED", created_at: ago(400), gig: { title: "Instagram carousel set, 6 slides" } },
    { id: "p3", worker_id: ME, gig_id: "g-old", amount: 4750, status: "COMPLETED", created_at: ago(900), gig: { title: "Event photography, 2 days" } },
  ],

  applications: [
    { id: "a1", gig_id: "g-deliver", worker_id: ME, status: "accepted", created_at: ago(49), gigs: { title: "Build a React dashboard for internal analytics" } },
    { id: "a2", gig_id: "g-open-2", worker_id: ME, status: "applied", created_at: ago(8), gigs: { title: "Flutter developer for a 2-week sprint" } },
  ],

  notifications: [
    { id: "n1", user_id: ME, type: "application", content: "4 people applied to “Design a poster for our fest”", link: "/gig/g-applicants", is_read: false, created_at: ago(1) },
    { id: "n2", user_id: ME, type: "gig", content: "Your work on “Landing page copy” was delivered", link: "/gig/g-waiting", is_read: false, created_at: ago(3) },
    { id: "n3", user_id: ME, type: "message", content: "Priya Nair sent you a message", link: "/messages", is_read: true, created_at: ago(20) },
  ],

  messages: [],
  companies: [
    { id: "c-nexa", name: "Nexa Labs", user_id: OTHER, pro_until: ahead(24 * 30) },
    { id: "c-vera", name: "Vera Goods", user_id: OTHER, pro_until: null },
  ],
  referrals: [{ id: "r1", referrer_id: ME }],
  points_transactions: [],
  inner_circle_applications: [
    { id: "ic1", user_id: ME, role: ROLE, status: "approved", pitch: "I build web apps.", links: [], decision_note: null, created_at: ago(24 * 20) },
  ],

  outreach_leads: [
    { id: "l1", owner_id: ME, company_name: "Zephyr Studios", website: "zephyr.studio", contact_name: "Rahul Menon", contact_email: "rahul@zephyr.studio", contact_phone: "9845012345", source: "linkedin", stage: "meeting", value_estimate: 40000, notes: "Wants a design retainer. Call booked for Thursday.", next_action_at: ahead(48), last_touch_at: ago(30), created_at: ago(24 * 9) },
    { id: "l2", owner_id: ME, company_name: "Kettle & Co", website: null, contact_name: "Ananya Rao", contact_email: "ananya@kettleandco.in", contact_phone: null, source: "campus", stage: "contacted", value_estimate: 12000, notes: "Café chain, 4 outlets. Needs social content monthly.", next_action_at: ago(26), last_touch_at: ago(100), created_at: ago(24 * 14) },
    { id: "l3", owner_id: null, company_name: "Hexa Fintech", website: "hexa.fin", contact_name: null, contact_email: "careers@hexa.fin", contact_phone: null, source: "inbound", stage: "new", value_estimate: null, notes: "Came through the contact form.", next_action_at: null, last_touch_at: null, created_at: ago(20) },
    { id: "l4", owner_id: OTHER, company_name: "Marigold Events", website: null, contact_name: "Sweta P", contact_email: "sweta@marigold.events", contact_phone: "9900112233", source: "referral", stage: "won", value_estimate: 60000, notes: "Signed. Posting three roles this month.", next_action_at: null, last_touch_at: ago(72), created_at: ago(24 * 30) },
    { id: "l5", owner_id: ME, company_name: "Orbit Tutors", website: null, contact_name: "Dev N", contact_email: "dev@orbittutors.com", contact_phone: null, source: "cold", stage: "lost", lost_reason: "Building an in-house team this year.", value_estimate: 15000, notes: null, next_action_at: null, last_touch_at: ago(24 * 10), created_at: ago(24 * 40) },
  ],
  outreach_touches: [],
};

/** Relationship columns in a select string, e.g. `owner:owner_id(name)`. */
function attachRelations(table: string, row: any) {
  if (table === "outreach_leads") {
    const owner = FIXTURES.users.find((u) => u.id === row.owner_id);
    return { ...row, owner: owner ? { name: owner.name } : null };
  }
  return row;
}

/**
 * A chainable stand-in for the PostgREST query builder.
 *
 * It records the filters it is given and applies the ones that change what the
 * UI shows — eq / neq / in / is / not — then resolves to `{ data, error }` when
 * awaited. Operators that only affect ordering or paging are accepted and
 * ignored; the goal is a populated screen, not a correct database.
 *
 * Writes report success without persisting, so clicking through a flow does not
 * throw. Nothing here is a substitute for testing against a real database.
 */
class MockQuery implements PromiseLike<any> {
  private rows: any[];
  private wantSingle = false;
  private maybe = false;
  private head = false;
  private wantCount = false;

  constructor(private table: string) {
    this.rows = (FIXTURES[table] ?? []).map((r) => attachRelations(table, r));
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.wantCount = true;
    if (opts?.head) this.head = true;
    return this;
  }
  eq(col: string, val: any) {
    this.rows = this.rows.filter((r) => String(r[col]) === String(val));
    return this;
  }
  neq(col: string, val: any) {
    this.rows = this.rows.filter((r) => String(r[col]) !== String(val));
    return this;
  }
  is(col: string, val: any) {
    this.rows = this.rows.filter((r) => (val === null ? r[col] == null : r[col] === val));
    return this;
  }
  in(col: string, vals: any[]) {
    this.rows = this.rows.filter((r) => vals.map(String).includes(String(r[col])));
    return this;
  }
  not(col: string, op: string, val: any) {
    if (op === "is" && val === null) this.rows = this.rows.filter((r) => r[col] != null);
    else if (op === "in") {
      const list = String(val).replace(/[()]/g, "").split(",").map((s) => s.trim());
      this.rows = this.rows.filter((r) => !list.includes(String(r[col])));
    }
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    const dir = opts?.ascending === false ? -1 : 1;
    this.rows = [...this.rows].sort((a, b) =>
      String(a?.[col] ?? "") > String(b?.[col] ?? "") ? dir : -dir
    );
    return this;
  }
  limit(n: number) {
    this.rows = this.rows.slice(0, n);
    return this;
  }
  range(from: number, to: number) {
    this.rows = this.rows.slice(from, to + 1);
    return this;
  }
  // Accepted and ignored — these narrow by date or build an `or` expression, and
  // neither changes whether a screen has something on it.
  or() { return this; }
  gt() { return this; }
  gte() { return this; }
  lt() { return this; }
  lte() { return this; }
  filter() { return this; }
  match() { return this; }
  contains() { return this; }
  textSearch() { return this; }
  abortSignal() { return this; }

  insert() { return this; }
  update() { return this; }
  upsert() { return this; }
  delete() { return this; }

  maybeSingle() { this.maybe = true; this.wantSingle = true; return this; }
  single() { this.wantSingle = true; return this; }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const count = this.rows.length;
    const data = this.head ? null : this.wantSingle ? this.rows[0] ?? null : this.rows;
    const error = this.wantSingle && !this.maybe && !this.rows[0] ? { message: "No rows" } : null;
    return Promise.resolve({
      data,
      error,
      ...(this.wantCount ? { count } : {}),
    }).then(onfulfilled, onrejected);
  }
}

const noopChannel = () => {
  const ch: any = {
    on: () => ch,
    subscribe: (cb?: (s: string) => void) => {
      cb?.("SUBSCRIBED");
      return ch;
    },
    unsubscribe: () => Promise.resolve("ok"),
  };
  return ch;
};

export function makePreviewClient(): any {
  return {
    from: (table: string) => new MockQuery(table),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: {
      getUser: async () => ({ data: { user: PREVIEW_USER }, error: null }),
      getSession: async () => ({
        data: { session: { user: PREVIEW_USER, access_token: "preview" } },
        error: null,
      }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      updateUser: async () => ({ data: { user: PREVIEW_USER }, error: null }),
    },
    storage: {
      from: () => ({
        // A real placeholder rather than a broken image, so cards with photos
        // show what a card with a photo actually looks like.
        getPublicUrl: (p: string) => ({ data: { publicUrl: p ? "/sloth.png" : "" } }),
        createSignedUrl: async () => ({ data: { signedUrl: "/sloth.png" }, error: null }),
        upload: async () => ({ data: { path: "preview" }, error: null }),
        remove: async () => ({ data: [], error: null }),
        list: async () => ({ data: [], error: null }),
      }),
    },
    channel: noopChannel,
    removeChannel: () => Promise.resolve("ok"),
    removeAllChannels: () => Promise.resolve([]),
  };
}
