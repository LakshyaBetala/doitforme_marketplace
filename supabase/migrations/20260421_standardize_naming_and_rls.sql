-- DOITFORME: MASTER SECURITY & NORMALIZATION MIGRATION
-- TERMINOLOGY: Hustler/Gig Standard
-- AUTH & SECURITY: Comprehensive RLS for Student & Company Nodes

-- ==========================================
-- 0. ADMIN HELPERS
-- ==========================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    auth.jwt() ->> 'email' IN ('betala911@gmail.com', 'doitforme.in@gmail.com')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 1. TERMINOLOGY NORMALIZATION (PROJECT -> GIG)
-- ==========================================

-- 1.1 Update Escrow Category Constraints
ALTER TABLE public.escrow DROP CONSTRAINT IF EXISTS escrow_escrow_category_check;
ALTER TABLE public.escrow ADD CONSTRAINT escrow_escrow_category_check 
  CHECK (escrow_category = ANY (ARRAY['GIG'::text, 'RENTAL_DEPOSIT'::text, 'MARKETPLACE'::text]));

-- 1.2 Update Escrow Defaults
ALTER TABLE public.escrow ALTER COLUMN escrow_category SET DEFAULT 'GIG'::text;

-- 1.3 Migrate Existing Data
UPDATE public.escrow SET escrow_category = 'GIG' WHERE escrow_category = 'PROJECT';

-- ==========================================
-- 2. PERFORMANCE OPTIMIZATION (INDICES)
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_gigs_poster_id ON public.gigs(poster_id);
CREATE INDEX IF NOT EXISTS idx_gigs_status ON public.gigs(status);
CREATE INDEX IF NOT EXISTS idx_applications_gig_id ON public.applications(gig_id);
CREATE INDEX IF NOT EXISTS idx_applications_worker_id ON public.applications(worker_id);
CREATE INDEX IF NOT EXISTS idx_messages_gig_id ON public.messages(gig_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);

-- ==========================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all core tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- 3.1 USERS TABLE
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
CREATE POLICY "Public profiles are viewable by everyone" ON public.users
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- 3.2 GIGS TABLE
DROP POLICY IF EXISTS "Gigs are viewable by everyone" ON public.gigs;
CREATE POLICY "Gigs are viewable by everyone" ON public.gigs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can post gigs" ON public.gigs;
CREATE POLICY "Authenticated users can post gigs" ON public.gigs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = poster_id);

DROP POLICY IF EXISTS "Posters can update their own gigs" ON public.gigs;
CREATE POLICY "Posters can update their own gigs" ON public.gigs
  FOR UPDATE USING (auth.uid() = poster_id OR is_admin());

-- 3.3 APPLICATIONS TABLE
DROP POLICY IF EXISTS "Applicants and posters can view applications" ON public.applications;
CREATE POLICY "Applicants and posters can view applications" ON public.applications
  FOR SELECT USING (
    auth.uid() = worker_id OR 
    EXISTS (SELECT 1 FROM public.gigs WHERE id = gig_id AND poster_id = auth.uid()) OR
    is_admin()
  );

DROP POLICY IF EXISTS "Only students can apply" ON public.applications;
CREATE POLICY "Only students can apply" ON public.applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = worker_id);

-- 3.4 MESSAGES TABLE
DROP POLICY IF EXISTS "Participants can view their messages" ON public.messages;
CREATE POLICY "Participants can view their messages" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR is_admin());

DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- 3.5 FINANCIAL TABLES (ESCROW / TRANSACTIONS)
DROP POLICY IF EXISTS "Only involved parties can view transaction data" ON public.transactions;
CREATE POLICY "Only involved parties can view transaction data" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "Only involved parties can view escrow data" ON public.escrow;
CREATE POLICY "Only involved parties can view escrow data" ON public.escrow
  FOR SELECT USING (auth.uid() = poster_id OR auth.uid() = worker_id OR is_admin());

-- 3.6 PAYOUT QUEUE
DROP POLICY IF EXISTS "Users can view their own payouts" ON public.payout_queue;
CREATE POLICY "Users can view their own payouts" ON public.payout_queue
  FOR SELECT USING (auth.uid() = worker_id OR is_admin());

-- 3.7 WALLETS
DROP POLICY IF EXISTS "Users can view their own wallet" ON public.wallets;
CREATE POLICY "Users can view their own wallet" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- 3.8 COMPANIES
DROP POLICY IF EXISTS "Active companies are viewable by all" ON public.companies;
CREATE POLICY "Active companies are viewable by all" ON public.companies
  FOR SELECT USING (is_active = true OR auth.uid() = user_id OR is_admin());

-- ==========================================
-- 4. STORAGE BUCKET POLICIES
-- ==========================================

-- 4.1 GIG IMAGES (Anyone can view, owner can upload)
DROP POLICY IF EXISTS "Anyone can view gig images" ON storage.objects;
CREATE POLICY "Anyone can view gig images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'gig-images');

DROP POLICY IF EXISTS "Authenticated users can upload gig images" ON storage.objects;
CREATE POLICY "Authenticated users can upload gig images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'gig-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 4.2 RESUMES (Secured: Only owner and Admin/Companies can view)
DROP POLICY IF EXISTS "Owner and admin can view resumes" ON storage.objects;
CREATE POLICY "Owner and admin can view resumes" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'resumes' AND ((auth.uid())::text = (storage.foldername(name))[1] OR is_admin()));
