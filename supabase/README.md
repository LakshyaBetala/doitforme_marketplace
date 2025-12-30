# Supabase Deployment & Migration Guide

This guide contains SQL migration files and instructions to deploy the database schema and RPCs required by the app.

Files are in `supabase/sql/` and are intended to be executed in order (01 → 08).

Required environment variables for runtime (backend):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (keep secret)
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
- `ADMIN_SECRET` (optional, for admin header checks)
- `CRON_SECRET` (optional, for scheduled auto-release)

Deployment steps (recommended):

1. Open Supabase dashboard → SQL Editor.
2. Run files in this order:
   - `01_wallets_table.sql`
   - `02_escrow_table.sql`
   - `03_transactions_table.sql`
   - `04_escrow_events_table.sql`
   - `05_chat_blocked_logs.sql`
   - `06_withdrawal_requests.sql`
   - `07_indexes_and_constraints.sql`
   - `08_rpcs_bundle.sql`

3. Verify each step succeeded; error messages will usually indicate missing dependencies.

Testing before frontend integration:

- Create a dev Supabase project or use the local emulator.
- Insert a sample `wallets` row for a test user and test `freeze_wallet_amount` / `unfreeze_wallet_amount` RPCs via SQL:

```sql
SELECT public.freeze_wallet_amount('<test-user-uuid>', 10);
SELECT public.unfreeze_wallet_amount('<test-user-uuid>', 10);
```

- Test the `release_escrow_transactional` / `refund_escrow_transactional` RPCs by inserting a `gigs` record (with `id`) and an `escrow` row, then calling the RPCs:

```sql
SELECT public.release_escrow_transactional('<gig-uuid>');
SELECT public.refund_escrow_transactional('<gig-uuid>', '<poster-uuid>');
```

Cron setup:

- Use your hosting provider's scheduled jobs or GitHub Actions to POST to the protected route `GET /api/cron/auto-release` with header `x-cron-secret` set to `CRON_SECRET`.
- Example curl (from a secure environment):

```bash
curl -H "x-cron-secret: $CRON_SECRET" https://your-site.example.com/api/cron/auto-release
```

Checklist before testing in staging:

- [ ] Run all SQL migration files in order and verify no errors.
- [ ] Ensure `escrow` rows are being created by the `verify-payment` flow (route already patched to insert escrow rows).
- [ ] Ensure `SUPABASE_SERVICE_ROLE_KEY` is secured and rotated if it was previously committed to repo.
- [ ] Verify RPCs respond and perform expected state transitions using the SQL editor.
- [ ] Run TypeScript build on server to catch any import/name issues.

If you want, I can generate a single combined migration file or a deployment script to run these in sequence.
