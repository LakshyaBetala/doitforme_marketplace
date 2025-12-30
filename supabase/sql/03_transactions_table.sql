-- 03_transactions_table.sql
-- Transactions ledger for wallet and payments
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid,
  user_id uuid,
  amount numeric NOT NULL,
  type text,
  status text,
  razorpay_payment_id text,
  razorpay_order_id text,
  created_at timestamptz DEFAULT now()
);

-- unique constraint on razorpay_payment_id when present
CREATE UNIQUE INDEX IF NOT EXISTS ux_transactions_razorpay_payment_id ON public.transactions(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
