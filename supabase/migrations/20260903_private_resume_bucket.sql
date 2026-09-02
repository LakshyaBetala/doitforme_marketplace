-- Take resumes out of public storage.
--
-- 20260902_lock_down_rpcs_and_storage.sql stopped anonymous callers ENUMERATING
-- the bucket, which was the live breach. It did not make the files private:
-- `resumes` was still a public bucket, users.resume_url held a permanent public
-- URL, and that URL was rendered straight into an <a href>. Anyone who ever
-- obtained a link — shared, in a referrer, in a synced history — kept read
-- access to that student's CV forever. 671 students had one uploaded.
--
-- PREREQUISITE: scripts/migrate-resumes-private.mjs --apply must have run.
-- It rewrites users.resume_url from a public URL to a bare object path and
-- moves the 13 files that the API upload path had misfiled into `gig-images`.
-- Flipping the bucket before that runs breaks every resume link in between.
-- Applied 2026-09-03: 657 normalised, 13 moved, 0 failures.
--
-- Reads now go through /api/profile/resume, which authorizes the caller — the
-- student themselves, an admin, or a poster the student actually applied to —
-- and mints a 5-minute signed URL. Signed URLs are generated with the service
-- role, so no storage SELECT policy is needed and none is added: a policy here
-- would only re-open direct access.
--
-- verification-docs is flipped too. It is empty, but it is named for identity
-- documents and defaulted to public, which is how kyc-ids would have looked if
-- someone had picked the wrong bucket.
--
-- Safe to run more than once.

BEGIN;

UPDATE storage.buckets SET public = false WHERE id IN ('resumes', 'verification-docs');

-- Uploads still have to work. Both upload paths write under `<user id>/...`,
-- so a student can write and overwrite inside their own folder and nowhere
-- else. Reading is deliberately NOT granted.
DROP POLICY IF EXISTS "own_folder_resume_insert" ON storage.objects;
CREATE POLICY "own_folder_resume_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "own_folder_resume_update" ON storage.objects;
CREATE POLICY "own_folder_resume_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
